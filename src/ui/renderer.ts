// Three.js 3D renderer: reads engine state and draws it. No game logic and
// no React here — GameCanvas.tsx owns the <canvas> element and a single
// GameRenderer instance driving its own requestAnimationFrame loop.
//
// Layout: the tile map lives on the XZ plane (tile (x, y) → world
// (x + 0.5, 0, y + 0.5)); +Y is up. Entities move on 600ms engine ticks;
// the renderer interpolates between the previous and current tile per
// entity so motion looks smooth (a pure UI concern — the engine only ever
// knows whole tiles).
import * as THREE from 'three'
import type { NpcDef } from '../content/types'
import type { Fire, Game, GroundItem, Npc, ResourceNode, WorldObject } from '../engine'
import { getItemDef, TICK_MS } from '../engine'

/** Canvas viewport size in pixels. */
export const VIEW_W = 720
export const VIEW_H = 480

/** Hovered tile in map coordinates (null when the mouse is outside). */
export interface Hover {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Approximate OSRS combat level for an NPC def (melee-only stats; ranged,
 * magic and prayer terms are omitted because NPCs have none here).
 */
export function npcCombatLevel(def: NpcDef): number {
  const c = def.combat
  const base = 0.25 * (c.defenceLevel + c.hitpoints)
  const melee = 0.325 * (c.attackLevel + c.strengthLevel)
  return Math.max(1, Math.floor(base + melee))
}

/** One-line description of what sits on a tile (hover tooltip), or null. */
export function describeTile(game: Game, x: number, y: number): string | null {
  const npc = game.npcs.find((n) => n.alive && n.x === x && n.y === y)
  if (npc) return `${npc.def.name} (level ${npcCombatLevel(npc.def)})`
  const node = game.world.nodeAt(x, y)
  if (node) return node.depleted ? `${node.def.name} (depleted)` : node.def.name
  const object = game.world.objectAt(x, y)
  if (object) return object.def.name
  const item = game.groundItems.itemsAt(x, y)[0]
  if (item) return `Take ${getItemDef(item.itemId).name}`
  if (game.fires.fireAt(x, y)) return 'Fire'
  return null
}

// ---- Palette (matches the old 2D renderer where sensible) ----

const GRASS_A = 0x3d5c33
const GRASS_B = 0x38552f
const BLOCKED = 0x2c3540
const PLAYER_BODY = 0x3b6ea5
const PLAYER_HEAD = 0xe8d5b5

const NPC_COLORS: Record<string, number> = {
  goblin: 0x6ab04c,
  cow: 0x8d6e63,
  chicken: 0xf5f0e6,
  giant_rat: 0x8d8d8d,
}
const NPC_FALLBACK = 0xc678dd

const ORE_SPECKLE: Record<string, number> = {
  copper_rock: 0xc97e3d,
  tin_rock: 0xcfd4dc,
  iron_rock: 0xa04a3c,
}

// ---- Camera constants (OSRS-style orbit around the player) ----

const CAM_MIN_DIST = 5
const CAM_MAX_DIST = 30
const CAM_MIN_PITCH = 0.35
const CAM_MAX_PITCH = 1.35
/** Arrow-key rotate speed, radians per second. */
const KEY_YAW_SPEED = 2.2
const KEY_PITCH_SPEED = 1.4

/** Tile-position pair used to interpolate one entity between ticks. */
interface MoverLerp {
  px: number
  py: number
  cx: number
  cy: number
}

interface NpcView {
  group: THREE.Group
  hpBar: THREE.Group
  hpFill: THREE.Mesh
}

interface NodeView {
  group: THREE.Group
  live: THREE.Group
  depleted: THREE.Group
}

/**
 * Owns the WebGL context, scene graph, orbit camera, input listeners for
 * camera control (middle-drag / arrow keys / wheel) and the rAF loop.
 * Mouse *commands* (click / context menu / hover) stay in GameCanvas.tsx,
 * which calls `pickTile` to translate pixels into map tiles.
 */
export class GameRenderer {
  private readonly game: Game
  private readonly canvas: HTMLCanvasElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly raycaster = new THREE.Raycaster()

  // Shared resources, tracked so dispose() can free GPU memory.
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materialCache = new Map<string, THREE.Material>()

  // Static ground meshes plus instance-index → tile lookup for picking.
  private groundMesh!: THREE.InstancedMesh
  private blockedMesh!: THREE.InstancedMesh
  private groundTiles: Hover[] = []
  private blockedTiles: Hover[] = []

  /** Root for everything pickable that carries userData.tile. */
  private readonly dynamicRoot = new THREE.Group()

  // Per-engine-object views, synced against engine state every frame.
  private playerGroup!: THREE.Group
  private readonly npcViews = new Map<Npc, NpcView>()
  private readonly nodeViews = new Map<ResourceNode, NodeView>()
  private readonly fireViews = new Map<Fire, THREE.Group>()
  private readonly itemViews = new Map<GroundItem, THREE.Object3D>()
  private hoverMesh!: THREE.LineLoop

  // Tick interpolation state.
  private readonly movers = new Map<object, MoverLerp>()
  private lastTickAt = performance.now()
  private readonly unsubscribeTick: () => void

  // Orbit camera state.
  private camYaw = Math.PI
  private camPitch = 0.9
  private camDist = 13
  private readonly pressedKeys = new Set<string>()
  private middleDrag: { x: number; y: number } | null = null

  private rafId = 0
  private lastFrameAt = performance.now()
  private disposed = false

  // Bound listeners (kept so dispose() can remove them).
  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    this.camDist = clamp(this.camDist * (1 + e.deltaY * 0.001), CAM_MIN_DIST, CAM_MAX_DIST)
  }
  private readonly onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 1) return
    e.preventDefault()
    this.middleDrag = { x: e.clientX, y: e.clientY }
  }
  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.middleDrag) return
    this.camYaw -= (e.clientX - this.middleDrag.x) * 0.008
    this.camPitch = clamp(
      this.camPitch + (e.clientY - this.middleDrag.y) * 0.005,
      CAM_MIN_PITCH,
      CAM_MAX_PITCH,
    )
    this.middleDrag = { x: e.clientX, y: e.clientY }
  }
  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 1) this.middleDrag = null
  }
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!e.key.startsWith('Arrow')) return
    const target = e.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    e.preventDefault()
    this.pressedKeys.add(e.key)
  }
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressedKeys.delete(e.key)
  }

  constructor(canvas: HTMLCanvasElement, game: Game) {
    this.canvas = canvas
    this.game = game
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(VIEW_W, VIEW_H, false)
    this.scene.background = new THREE.Color(0x0d0b08)
    this.scene.fog = new THREE.Fog(0x0d0b08, 30, 60)

    this.camera = new THREE.PerspectiveCamera(50, VIEW_W / VIEW_H, 0.1, 200)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65))
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.1)
    sun.position.set(20, 30, 10)
    this.scene.add(sun)

    this.buildGround()
    this.buildStaticObjects()
    this.buildNodes()
    this.buildPlayer()
    this.buildHover()
    this.scene.add(this.dynamicRoot)

    // Snapshot mover positions once per engine tick for interpolation.
    this.unsubscribeTick = game.events.on('tick', () => this.snapshotMovers())
    this.snapshotMovers()

    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    const loop = (): void => {
      if (this.disposed) return
      this.renderFrame()
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  // ---- Resource helpers ----

  private geo<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry)
    return geometry
  }

  /** Cached Lambert material per color/options (freed in dispose). */
  private mat(color: number, opts?: { transparent?: boolean; opacity?: number }): THREE.Material {
    const key = `${color}:${opts?.opacity ?? 1}`
    let material = this.materialCache.get(key)
    if (!material) {
      material = new THREE.MeshLambertMaterial({
        color,
        transparent: opts?.transparent ?? false,
        opacity: opts?.opacity ?? 1,
      })
      this.materialCache.set(key, material)
    }
    return material
  }

  private mesh(geometry: THREE.BufferGeometry, color: number, y: number): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.mat(color))
    mesh.position.y = y
    return mesh
  }

  // ---- Static scene construction ----

  /** Walkable tiles: instanced checkerboard planes. Blocked: gray boxes. */
  private buildGround(): void {
    const world = this.game.world
    const walk: Hover[] = []
    const block: Hover[] = []
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        // Node/object tiles render as grass too (the mesh sits on top).
        if (world.isWalkable(x, y) || world.nodeAt(x, y) || world.objectAt(x, y)) {
          walk.push({ x, y })
        } else {
          block.push({ x, y })
        }
      }
    }
    this.groundTiles = walk
    this.blockedTiles = block

    const plane = this.geo(new THREE.PlaneGeometry(1, 1))
    plane.rotateX(-Math.PI / 2)
    this.groundMesh = new THREE.InstancedMesh(
      plane,
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      walk.length,
    )
    const m = new THREE.Matrix4()
    const color = new THREE.Color()
    walk.forEach((tile, i) => {
      m.setPosition(tile.x + 0.5, 0, tile.y + 0.5)
      this.groundMesh.setMatrixAt(i, m)
      this.groundMesh.setColorAt(i, color.setHex((tile.x + tile.y) % 2 === 0 ? GRASS_A : GRASS_B))
    })
    this.scene.add(this.groundMesh)

    const box = this.geo(new THREE.BoxGeometry(1, 0.8, 1))
    this.blockedMesh = new THREE.InstancedMesh(
      box,
      new THREE.MeshLambertMaterial({ color: BLOCKED }),
      block.length,
    )
    block.forEach((tile, i) => {
      m.setPosition(tile.x + 0.5, 0.4, tile.y + 0.5)
      this.blockedMesh.setMatrixAt(i, m)
    })
    this.scene.add(this.blockedMesh)
    // Material of the instanced meshes is not in materialCache; track it.
    this.materialCache.set('ground', this.groundMesh.material as THREE.Material)
    this.materialCache.set('blocked', this.blockedMesh.material as THREE.Material)
  }

  /** Bank booths (gold) and cooking ranges (dark red) as boxes. */
  private buildStaticObjects(): void {
    for (const object of this.game.world.objects) {
      const group = this.tileGroup(object.position.x, object.position.y)
      group.add(this.mesh(this.geo(new THREE.BoxGeometry(0.9, 1, 0.9)), this.objectColor(object), 0.5))
      this.dynamicRoot.add(group)
    }
  }

  private objectColor(object: WorldObject): number {
    return object.def.bank ? 0xd4af37 : 0x7a2318
  }

  /** Trees (trunk + canopy / stump), rocks (dodecahedron), fishing rings. */
  private buildNodes(): void {
    for (const node of this.game.world.nodes) {
      const group = this.tileGroup(node.position.x, node.position.y)
      const live = new THREE.Group()
      const depleted = new THREE.Group()
      const skill = node.def.skill

      if (skill === 'woodcutting') {
        const trunk = this.mesh(this.geo(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 8)), 0x4e342e, 0.45)
        const canopyColor = node.def.id === 'oak_tree' ? 0x1e5e2a : 0x2e7d32
        const canopy = this.mesh(this.geo(new THREE.IcosahedronGeometry(0.6, 1)), canopyColor, 1.25)
        live.add(trunk, canopy)
        depleted.add(this.mesh(this.geo(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 8)), 0x5d4030, 0.125))
      } else if (skill === 'mining') {
        const rock = this.mesh(this.geo(new THREE.DodecahedronGeometry(0.45)), 0x767676, 0.3)
        rock.scale.y = 0.7
        const speckle = this.mesh(
          this.geo(new THREE.DodecahedronGeometry(0.16)),
          ORE_SPECKLE[node.def.id] ?? 0xffffff,
          0.55,
        )
        speckle.position.x = 0.12
        live.add(rock, speckle)
        const bare = this.mesh(this.geo(new THREE.DodecahedronGeometry(0.45)), 0x4c4c4c, 0.3)
        bare.scale.y = 0.7
        depleted.add(bare)
      } else {
        // Fishing spot: concentric flat rings on the water (never depletes).
        for (const radius of [0.15, 0.3, 0.45]) {
          const ring = new THREE.Mesh(
            this.geo(new THREE.RingGeometry(radius, radius + 0.05, 24)),
            this.mat(0x4fc3f7, { transparent: true, opacity: 0.8 }),
          )
          ring.rotation.x = -Math.PI / 2
          ring.position.y = 0.03
          live.add(ring)
        }
      }

      group.add(live, depleted)
      this.dynamicRoot.add(group)
      this.nodeViews.set(node, { group, live, depleted })
    }
  }

  /** Blue capsule body + cream head, following the interpolated tile. */
  private buildPlayer(): void {
    const group = this.tileGroup(this.game.player.x, this.game.player.y)
    group.add(this.mesh(this.geo(new THREE.CapsuleGeometry(0.25, 0.55, 4, 12)), PLAYER_BODY, 0.55))
    group.add(this.mesh(this.geo(new THREE.SphereGeometry(0.16, 12, 12)), PLAYER_HEAD, 1.1))
    this.playerGroup = group
    this.dynamicRoot.add(group)
  }

  private buildHover(): void {
    const points = [
      new THREE.Vector3(-0.5, 0, -0.5),
      new THREE.Vector3(0.5, 0, -0.5),
      new THREE.Vector3(0.5, 0, 0.5),
      new THREE.Vector3(-0.5, 0, 0.5),
    ]
    const geometry = this.geo(new THREE.BufferGeometry().setFromPoints(points))
    const material = new THREE.LineBasicMaterial({ color: 0xf4d03f })
    this.materialCache.set('hoverLine', material)
    this.hoverMesh = new THREE.LineLoop(geometry, material)
    this.hoverMesh.position.y = 0.04
    this.hoverMesh.visible = false
    this.scene.add(this.hoverMesh)
  }

  /** A group parked on a tile center, tagged with the tile for picking. */
  private tileGroup(x: number, y: number): THREE.Group {
    const group = new THREE.Group()
    group.position.set(x + 0.5, 0, y + 0.5)
    group.userData.tile = { x, y }
    return group
  }

  // ---- Tick interpolation ----

  /** Shift current → previous for every mover; runs once per engine tick. */
  private snapshotMovers(): void {
    this.lastTickAt = performance.now()
    const track = (key: object, x: number, y: number): void => {
      const state = this.movers.get(key)
      if (!state) {
        this.movers.set(key, { px: x, py: y, cx: x, cy: y })
        return
      }
      state.px = state.cx
      state.py = state.cy
      state.cx = x
      state.cy = y
      // Teleports (death respawn etc.) snap instead of gliding across the map.
      if (Math.max(Math.abs(state.cx - state.px), Math.abs(state.cy - state.py)) > 3) {
        state.px = state.cx
        state.py = state.cy
      }
    }
    track(this.game.player, this.game.player.x, this.game.player.y)
    for (const npc of this.game.npcs) {
      if (npc.alive) track(npc, npc.x, npc.y)
      else this.movers.delete(npc) // Snap into place on respawn.
    }
  }

  /** Interpolated tile-space position of a mover at this instant. */
  private moverPos(key: object, x: number, y: number): { x: number; y: number } {
    const state = this.movers.get(key)
    if (!state) return { x, y }
    const t = clamp((performance.now() - this.lastTickAt) / TICK_MS, 0, 1)
    return { x: lerp(state.px, state.cx, t), y: lerp(state.py, state.cy, t) }
  }

  // ---- Per-frame sync + render ----

  private renderFrame(): void {
    const now = performance.now()
    const dt = Math.min((now - this.lastFrameAt) / 1000, 0.1)
    this.lastFrameAt = now

    this.syncScene(now)
    this.updateCamera(dt)
    this.renderer.render(this.scene, this.camera)
  }

  /** Force an immediate state sync + draw (e.g. after a UI command). */
  syncNow(): void {
    if (!this.disposed) this.renderFrame()
  }

  private syncScene(now: number): void {
    const game = this.game

    // Player.
    const p = this.moverPos(game.player, game.player.x, game.player.y)
    this.playerGroup.position.set(p.x + 0.5, 0, p.y + 0.5)
    this.playerGroup.userData.tile = { x: game.player.x, y: game.player.y }

    // NPCs: lazily created, hidden while dead, hp bar when damaged.
    for (const npc of game.npcs) {
      let view = this.npcViews.get(npc)
      if (!view) {
        view = this.buildNpc(npc)
        this.npcViews.set(npc, view)
        this.dynamicRoot.add(view.group)
      }
      view.group.visible = npc.alive
      if (!npc.alive) continue
      const pos = this.moverPos(npc, npc.x, npc.y)
      view.group.position.set(pos.x + 0.5, 0, pos.y + 0.5)
      view.group.userData.tile = { x: npc.x, y: npc.y }
      const maxHp = npc.def.combat.hitpoints
      view.hpBar.visible = npc.currentHp < maxHp
      if (view.hpBar.visible) {
        view.hpFill.scale.x = Math.max(npc.currentHp / maxHp, 0.001)
        view.hpBar.quaternion.copy(this.camera.quaternion)
      }
    }

    // Resource nodes: swap live/depleted looks; pulse fishing rings.
    for (const [node, view] of this.nodeViews) {
      view.live.visible = !node.depleted
      view.depleted.visible = node.depleted
      if (node.def.skill === 'fishing') {
        view.live.children.forEach((ring, i) => {
          const s = 1 + 0.15 * Math.sin(now / 500 + i)
          ring.scale.set(s, s, 1)
        })
      }
    }

    // Fires: add new, remove expired, flicker the flames.
    const liveFires = new Set(game.fires.fires)
    for (const [fire, group] of this.fireViews) {
      if (!liveFires.has(fire)) {
        this.dynamicRoot.remove(group)
        this.fireViews.delete(fire)
      }
    }
    for (const fire of game.fires.fires) {
      let group = this.fireViews.get(fire)
      if (!group) {
        group = this.tileGroup(fire.position.x, fire.position.y)
        group.add(this.mesh(this.geo(new THREE.ConeGeometry(0.3, 0.6, 8)), 0xe25822, 0.3))
        group.add(this.mesh(this.geo(new THREE.ConeGeometry(0.15, 0.4, 8)), 0xffb347, 0.45))
        this.fireViews.set(fire, group)
        this.dynamicRoot.add(group)
      }
      const flicker = 1 + 0.12 * Math.sin(now / 90 + fire.position.x * 7 + fire.position.y * 13)
      group.scale.y = flicker
    }

    // Ground items: yellow octahedra that slowly spin.
    const liveItems = new Set(game.groundItems.items)
    for (const [item, mesh] of this.itemViews) {
      if (!liveItems.has(item)) {
        this.dynamicRoot.remove(mesh)
        this.itemViews.delete(item)
      }
    }
    for (const item of game.groundItems.items) {
      let view = this.itemViews.get(item)
      if (!view) {
        const group = this.tileGroup(item.x, item.y)
        group.add(this.mesh(this.geo(new THREE.OctahedronGeometry(0.16)), 0xf4d03f, 0.2))
        this.itemViews.set(item, group)
        this.dynamicRoot.add(group)
        view = group
      }
      view.rotation.y = now / 800
    }
  }

  private buildNpc(npc: Npc): NpcView {
    const group = this.tileGroup(npc.x, npc.y)
    const color = NPC_COLORS[npc.def.id] ?? NPC_FALLBACK
    let barHeight = 1
    if (npc.def.id === 'chicken') {
      group.add(this.mesh(this.geo(new THREE.BoxGeometry(0.32, 0.32, 0.32)), color, 0.18))
      barHeight = 0.6
    } else if (npc.def.id === 'cow') {
      group.add(this.mesh(this.geo(new THREE.BoxGeometry(0.5, 0.5, 0.8)), color, 0.35))
      const patch = this.mesh(this.geo(new THREE.BoxGeometry(0.52, 0.25, 0.3)), 0xf5f0e6, 0.42)
      patch.position.z = 0.15
      group.add(patch)
      barHeight = 0.9
    } else if (npc.def.id === 'giant_rat') {
      group.add(this.mesh(this.geo(new THREE.BoxGeometry(0.36, 0.28, 0.68)), color, 0.16))
      barHeight = 0.6
    } else {
      group.add(this.mesh(this.geo(new THREE.CapsuleGeometry(0.2, 0.4, 4, 10)), color, 0.42))
    }

    // Billboarded hp bar: red background + left-anchored green fill.
    const hpBar = new THREE.Group()
    hpBar.position.y = barHeight + 0.25
    const barGeo = this.geo(new THREE.PlaneGeometry(0.8, 0.09))
    const back = new THREE.Mesh(barGeo, this.mat(0xc0392b))
    const fillGeo = this.geo(new THREE.PlaneGeometry(0.8, 0.09))
    fillGeo.translate(0.4, 0, 0) // Anchor at the left edge so scale.x shrinks rightward.
    const fill = new THREE.Mesh(fillGeo, this.mat(0x27ae60))
    fill.position.set(-0.4, 0, 0.001)
    hpBar.add(back, fill)
    hpBar.visible = false
    group.add(hpBar)

    return { group, hpBar, hpFill: fill }
  }

  private updateCamera(dt: number): void {
    if (this.pressedKeys.has('ArrowLeft')) this.camYaw += KEY_YAW_SPEED * dt
    if (this.pressedKeys.has('ArrowRight')) this.camYaw -= KEY_YAW_SPEED * dt
    if (this.pressedKeys.has('ArrowUp')) this.camPitch += KEY_PITCH_SPEED * dt
    if (this.pressedKeys.has('ArrowDown')) this.camPitch -= KEY_PITCH_SPEED * dt
    this.camPitch = clamp(this.camPitch, CAM_MIN_PITCH, CAM_MAX_PITCH)

    // The interpolated player position is already smooth; track it directly.
    const p = this.moverPos(this.game.player, this.game.player.x, this.game.player.y)
    const tx = p.x + 0.5
    const tz = p.y + 0.5
    const horizontal = this.camDist * Math.cos(this.camPitch)
    this.camera.position.set(
      tx + horizontal * Math.sin(this.camYaw),
      this.camDist * Math.sin(this.camPitch),
      tz + horizontal * Math.cos(this.camYaw),
    )
    this.camera.lookAt(tx, 0.5, tz)
  }

  // ---- Picking + hover ----

  /**
   * Map a mouse event position to the map tile under the cursor, or null.
   * Entity/node/object meshes win over the ground (so clicking a tree's
   * canopy targets the tree's tile); ground hits use the instance index.
   */
  pickTile(clientX: number, clientY: number): Hover | null {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hits = this.raycaster.intersectObjects(
      [this.dynamicRoot, this.groundMesh, this.blockedMesh],
      true,
    )
    for (const hit of hits) {
      if (hit.object === this.groundMesh && hit.instanceId !== undefined) {
        return this.groundTiles[hit.instanceId] ?? null
      }
      if (hit.object === this.blockedMesh && hit.instanceId !== undefined) {
        return this.blockedTiles[hit.instanceId] ?? null
      }
      // Walk up to the tagged tile group (entity, node, object, fire, item).
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        const tile = o.userData.tile as Hover | undefined
        if (tile) return tile
      }
    }
    return null
  }

  /** Show/move the yellow tile outline (null hides it). */
  setHover(hover: Hover | null): void {
    if (!hover || !this.game.world.inBounds(hover.x, hover.y)) {
      this.hoverMesh.visible = false
      return
    }
    this.hoverMesh.visible = true
    // Outline blocked wall tops instead of z-fighting under the box.
    const onWall = !this.game.world.isWalkable(hover.x, hover.y) &&
      !this.game.world.nodeAt(hover.x, hover.y) &&
      !this.game.world.objectAt(hover.x, hover.y)
    this.hoverMesh.position.set(hover.x + 0.5, onWall ? 0.85 : 0.04, hover.y + 0.5)
  }

  /** Stop the rAF loop, detach listeners and free all GPU resources. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.unsubscribeTick()
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materialCache.values()) material.dispose()
    this.groundMesh.dispose()
    this.blockedMesh.dispose()
    this.renderer.dispose()
  }
}
