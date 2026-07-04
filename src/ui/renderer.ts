// Three.js 3D renderer: reads engine state and draws it. No game logic and
// no React here — GameCanvas.tsx owns the <canvas> element and a single
// GameRenderer instance driving its own requestAnimationFrame loop.
//
// Layout: the tile map lives on the XZ plane (tile (x, y) → world
// (x + 0.5, 0, y + 0.5)); +Y is up. Entities move on 600ms engine ticks;
// the renderer interpolates between the previous and current tile per
// entity so motion looks smooth (a pure UI concern — the engine only ever
// knows whole tiles).
//
// Mesh construction lives in src/ui/sprites/ (one file per visual object);
// this class only orchestrates: scene setup, camera, lighting, picking,
// tick interpolation, and calling the sprite factories/updaters.
import * as THREE from 'three'
import type { NpcDef } from '../content/types'
import type { Fire, Game, GroundItem, Npc, ResourceNode } from '../engine'
import { getItemDef, TICK_MS } from '../engine'
import {
  createBankBoothMesh,
  createCookingRangeMesh,
  createFireMesh,
  createFishingSpotMesh,
  createGroundItemMesh,
  createGroundTiles,
  createHoverOutline,
  createNpcMesh,
  createPlayerMesh,
  createRockMesh,
  createTreeMesh,
  SpriteResources,
  tileGroup,
  updateFireFlicker,
  updateFishingSpotPulse,
  updateGroundItemSpin,
  updateHealthBar,
  type NpcView,
} from './sprites'

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

  // Shared sprite resources, tracked so dispose() can free GPU memory.
  private readonly resources = new SpriteResources()

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
    this.playerGroup = createPlayerMesh(this.resources, game.player.x, game.player.y)
    this.dynamicRoot.add(this.playerGroup)
    this.hoverMesh = createHoverOutline(this.resources)
    this.scene.add(this.hoverMesh)
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

  // ---- Static scene construction ----

  private buildGround(): void {
    const ground = createGroundTiles(this.resources, this.game.world)
    this.groundMesh = ground.groundMesh
    this.blockedMesh = ground.blockedMesh
    this.groundTiles = ground.groundTiles
    this.blockedTiles = ground.blockedTiles
    this.scene.add(this.groundMesh, this.blockedMesh)
  }

  /** Bank booths and cooking ranges parked on their tiles. */
  private buildStaticObjects(): void {
    for (const object of this.game.world.objects) {
      const { x, y } = object.position
      const group = object.def.bank
        ? createBankBoothMesh(this.resources, x, y)
        : createCookingRangeMesh(this.resources, x, y)
      this.dynamicRoot.add(group)
    }
  }

  /** Trees (trunk + canopy / stump), rocks (dodecahedron), fishing rings. */
  private buildNodes(): void {
    for (const node of this.game.world.nodes) {
      const group = tileGroup(node.position.x, node.position.y)
      const skill = node.def.skill
      const { live, depleted } =
        skill === 'woodcutting'
          ? createTreeMesh(this.resources, node.def.id)
          : skill === 'mining'
            ? createRockMesh(this.resources, node.def.id)
            : createFishingSpotMesh(this.resources)
      group.add(live, depleted)
      this.dynamicRoot.add(group)
      this.nodeViews.set(node, { group, live, depleted })
    }
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
        view = createNpcMesh(this.resources, npc)
        this.npcViews.set(npc, view)
        this.dynamicRoot.add(view.group)
      }
      view.group.visible = npc.alive
      if (!npc.alive) continue
      const pos = this.moverPos(npc, npc.x, npc.y)
      view.group.position.set(pos.x + 0.5, 0, pos.y + 0.5)
      view.group.userData.tile = { x: npc.x, y: npc.y }
      updateHealthBar(view, npc.currentHp, npc.def.combat.hitpoints, this.camera.quaternion)
    }

    // Resource nodes: swap live/depleted looks; pulse fishing rings.
    for (const [node, view] of this.nodeViews) {
      view.live.visible = !node.depleted
      view.depleted.visible = node.depleted
      if (node.def.skill === 'fishing') updateFishingSpotPulse(view.live, now)
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
        group = createFireMesh(this.resources, fire)
        this.fireViews.set(fire, group)
        this.dynamicRoot.add(group)
      }
      updateFireFlicker(group, fire, now)
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
        view = createGroundItemMesh(this.resources, item)
        this.itemViews.set(item, view)
        this.dynamicRoot.add(view)
      }
      updateGroundItemSpin(view, now)
    }
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
    this.resources.dispose()
    this.groundMesh.dispose()
    this.blockedMesh.dispose()
    this.renderer.dispose()
  }
}
