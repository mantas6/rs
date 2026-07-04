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
import type { Fire, Game, GroundItem, Npc, PlayerActionKind, ResourceNode } from '../engine'
import { getItemDef, TICK_MS } from '../engine'
import {
  approachAngle,
  createBankBoothMesh,
  createCookingRangeMesh,
  createFireMesh,
  createFishingSpotMesh,
  createGroundItemMesh,
  createGroundTiles,
  createHitsplat,
  createHoverOutline,
  createNpcMesh,
  createPlayerMesh,
  createRockMesh,
  createShopCounterMesh,
  createTreeMesh,
  decay01,
  disposeHitsplat,
  progress01,
  SpriteResources,
  tileGroup,
  updateFireFlicker,
  updateFishingSpotPulse,
  updateGroundItemSpin,
  updateHealthBar,
  updateHitsplat,
  updateNpcAnimation,
  updatePlayerAnimation,
  updateWaterRipple,
  yawToward,
  type HitsplatView,
  type WaterAnimation,
  type NpcPose,
  type NpcView,
  type PlayerPose,
  type PlayerView,
} from './sprites'

/**
 * Fallback canvas viewport size in pixels. The live canvas is no longer
 * locked to this — GameRenderer observes its container and resizes to fill
 * it (see `resize`) — but these are kept as the initial/aspect fallback and
 * for any code that still wants a nominal size.
 */
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

/** Centroid + finger spread of a two-finger touch, for orbit/pinch. */
function touchInfo(e: TouchEvent): { x: number; y: number; dist: number } {
  const a = e.touches[0]
  const b = e.touches[1]
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
    dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
  }
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

// ---- Animation constants shared by the player and NPCs (purely visual;
// see sprites/playerMesh.ts and sprites/npcMesh.ts) ----

/** How long the red flash + flinch lasts after taking damage. */
const FLINCH_MS = 350
/** Duration of one attack-swing overlay after an attacker deals damage. */
const ATTACK_SWING_MS = 400
/** Fall-over time and total on-the-ground (corpse) time after dying. */
const DEATH_FALL_MS = 500
const DEATH_TOTAL_MS = 1100
/** Facing turn speed, radians per second. */
const TURN_SPEED = 12
/** World-space height a hitsplat floats at above the player's head. */
const PLAYER_HITSPLAT_HEIGHT = 1.5
/** Extra height above an NPC's health bar to float its hitsplats. */
const NPC_HITSPLAT_OFFSET = 0.18

/** Pose used for each engine action kind. */
const ACTION_POSE: Record<PlayerActionKind, PlayerPose> = {
  woodcutting: 'chop',
  mining: 'chop',
  fishing: 'fish',
  firemaking: 'firemaking',
  cooking: 'cook',
  banking: 'bank',
  shopping: 'bank',
  pickup: 'bank',
  combat: 'combat',
}

/** Tile-position pair used to interpolate one entity between ticks. */
interface MoverLerp {
  px: number
  py: number
  cx: number
  cy: number
}

/**
 * A live combat hitsplat plus what it follows. `npc` is the damaged NPC (its
 * interpolated position is tracked while alive; the splat freezes at the last
 * spot once it dies/despawns), or null when the splat sits above the player.
 * `x`/`z` cache the last world position so a frozen splat keeps rising in place.
 */
interface ActiveHitsplat {
  view: HitsplatView
  npc: Npc | null
  x: number
  z: number
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
  // Grass + water are flat planes; stone walls are raised boxes.
  private groundMesh!: THREE.InstancedMesh
  private waterMesh!: THREE.InstancedMesh
  private stoneMesh!: THREE.InstancedMesh
  private groundTiles: Hover[] = []
  private waterTiles: Hover[] = []
  private stoneTiles: Hover[] = []
  /** Keys (y*width + x) of raised stone tiles, for the hover-outline height. */
  private stoneTileKeys = new Set<number>()
  private waterAnim!: WaterAnimation

  /** Root for everything pickable that carries userData.tile. */
  private readonly dynamicRoot = new THREE.Group()

  // Per-engine-object views, synced against engine state every frame.
  private playerView!: PlayerView
  private readonly npcViews = new Map<Npc, NpcView>()
  private readonly nodeViews = new Map<ResourceNode, NodeView>()
  private readonly fireViews = new Map<Fire, THREE.Group>()
  private readonly itemViews = new Map<GroundItem, THREE.Object3D>()
  private hoverMesh!: THREE.LineLoop

  // Floating damage numbers. Held in a plain array (never pickable), parented
  // to their own scene group so they never intercept tile picks.
  private readonly hitsplats: ActiveHitsplat[] = []
  private readonly hitsplatRoot = new THREE.Group()

  // Tick interpolation state.
  private readonly movers = new Map<object, MoverLerp>()
  private lastTickAt = performance.now()
  private readonly unsubscribeTick: () => void

  // Player animation state (purely visual, driven by engine events/state).
  private playerYaw = Math.PI
  private lastHurtAt = -Infinity
  private lastAttackAt = -Infinity
  private diedAt = -Infinity
  private readonly unsubscribeAnimEvents: Array<() => void> = []

  // Orbit camera state.
  private camYaw = Math.PI
  private camPitch = 0.9
  private camDist = 13
  private readonly pressedKeys = new Set<string>()
  private middleDrag: { x: number; y: number } | null = null
  // Two-finger touch orbit/pinch state (centroid + finger spread).
  private touchGesture: { x: number; y: number; dist: number } | null = null

  // Keeps the renderer/camera matched to the canvas container's box.
  private readonly resizeObserver: ResizeObserver

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

  // Touch camera fallback: two fingers orbit (centroid drag) and pinch to
  // zoom. Single-finger taps are left to GameCanvas so tap-to-interact works.
  private readonly onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length !== 2) return
    e.preventDefault()
    this.touchGesture = touchInfo(e)
  }
  private readonly onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length !== 2 || !this.touchGesture) return
    e.preventDefault()
    const info = touchInfo(e)
    this.camYaw -= (info.x - this.touchGesture.x) * 0.008
    this.camPitch = clamp(
      this.camPitch + (info.y - this.touchGesture.y) * 0.005,
      CAM_MIN_PITCH,
      CAM_MAX_PITCH,
    )
    if (this.touchGesture.dist > 0 && info.dist > 0) {
      this.camDist = clamp(
        this.camDist * (this.touchGesture.dist / info.dist),
        CAM_MIN_DIST,
        CAM_MAX_DIST,
      )
    }
    this.touchGesture = info
  }
  private readonly onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) this.touchGesture = null
  }

  constructor(canvas: HTMLCanvasElement, game: Game) {
    this.canvas = canvas
    this.game = game
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    // Correct sRGB output plus filmic tone mapping so the brighter lights
    // below roll off gently instead of blowing out to flat white. Exposure
    // sits just above 1 for a sunny, inviting look.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // Size to the container's box (fallback to the nominal view if it hasn't
    // been laid out yet); the ResizeObserver below keeps it in sync.
    const parent = canvas.parentElement
    const initialW = parent?.clientWidth || VIEW_W
    const initialH = parent?.clientHeight || VIEW_H
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(initialW, initialH, false)
    // Bright sky-blue backdrop; fog shares a lighter sky tint and is pushed
    // far out so the world reads as open daylight rather than a dark box.
    this.scene.background = new THREE.Color(0x8fc9f2)
    this.scene.fog = new THREE.Fog(0xc6e6ff, 55, 130)

    this.camera = new THREE.PerspectiveCamera(50, initialW / initialH, 0.1, 200)

    // Sky/ground hemisphere fill keeps shadowed sides bright and colourful
    // (cool sky above, warm earth bounce below); the warm directional sun
    // adds shape and gentle daylight highlights on top.
    const hemi = new THREE.HemisphereLight(0xe4f2ff, 0x8a7d5a, 1.15)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff1d5, 1.35)
    sun.position.set(24, 34, 14)
    this.scene.add(sun)

    this.buildGround()
    this.buildStaticObjects()
    this.buildNodes()
    this.playerView = createPlayerMesh(this.resources, game.player.x, game.player.y)
    this.dynamicRoot.add(this.playerView.group)

    // Transient animation triggers (flinch, attack swing, death fall) for
    // the player and for the NPC instance carried by each combat event.
    this.unsubscribeAnimEvents.push(
      game.events.on('damageDealt', ({ source, targetId, damage, targetHpAfter, npc }) => {
        const at = performance.now()
        const view = this.npcView(npc)
        if (source === 'player') {
          this.lastAttackAt = at
          if (view && damage > 0) view.lastHurtAt = at
          if (view && targetHpAfter <= 0) view.diedAt = at
          this.spawnHitsplat(npc, damage, at) // Splat over the struck NPC.
        } else {
          if (targetId === 'player' && damage > 0) this.lastHurtAt = at
          if (view) view.lastAttackAt = at // NPC swings even on a miss
          this.spawnHitsplat(null, damage, at) // Splat over the player.
        }
      }),
      game.events.on('playerDied', () => {
        this.diedAt = performance.now()
      }),
    )
    this.hoverMesh = createHoverOutline(this.resources)
    this.scene.add(this.hoverMesh)
    this.scene.add(this.dynamicRoot)
    this.scene.add(this.hitsplatRoot)

    // Snapshot mover positions once per engine tick for interpolation.
    this.unsubscribeTick = game.events.on('tick', () => this.snapshotMovers())
    this.snapshotMovers()

    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('mousedown', this.onMouseDown)
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false })
    canvas.addEventListener('touchend', this.onTouchEnd)
    canvas.addEventListener('touchcancel', this.onTouchEnd)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    // Keep the drawing buffer + camera aspect matched to the container.
    this.resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) this.resize(rect.width, rect.height)
    })
    if (parent) this.resizeObserver.observe(parent)

    const loop = (): void => {
      if (this.disposed) return
      this.renderFrame()
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  // ---- Static scene construction ----

  private buildGround(): void {
    const anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const ground = createGroundTiles(this.resources, this.game.world, anisotropy)
    this.groundMesh = ground.groundMesh
    this.waterMesh = ground.waterMesh
    this.stoneMesh = ground.stoneMesh
    this.groundTiles = ground.groundTiles
    this.waterTiles = ground.waterTiles
    this.stoneTiles = ground.stoneTiles
    this.waterAnim = ground.water
    const width = this.game.world.width
    this.stoneTileKeys = new Set(this.stoneTiles.map((t) => t.y * width + t.x))
    this.scene.add(this.groundMesh, this.waterMesh, this.stoneMesh)
  }

  /** Bank booths, shop counters and cooking ranges parked on their tiles. */
  private buildStaticObjects(): void {
    for (const object of this.game.world.objects) {
      const { x, y } = object.position
      const group = object.def.bank
        ? createBankBoothMesh(this.resources, x, y)
        : object.def.shop
          ? createShopCounterMesh(this.resources, x, y)
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

    this.syncScene(now, dt)
    this.updateCamera(dt)
    this.renderer.render(this.scene, this.camera)
  }

  /** Force an immediate state sync + draw (e.g. after a UI command). */
  syncNow(): void {
    if (!this.disposed) this.renderFrame()
  }

  /**
   * Match the drawing buffer and camera aspect to the container's CSS box.
   * The canvas keeps its 100%×100% CSS size (setSize's updateStyle=false),
   * so picking (which uses getBoundingClientRect) stays accurate.
   */
  private resize(width: number, height: number): void {
    if (this.disposed || width === 0 || height === 0) return
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderFrame()
  }

  private syncScene(now: number, dt: number): void {
    const game = this.game

    // Drift the water surface so the river looks like it flows.
    updateWaterRipple(this.waterAnim, now)

    // Player.
    const p = this.moverPos(game.player, game.player.x, game.player.y)
    this.playerView.group.position.set(p.x + 0.5, 0, p.y + 0.5)
    this.playerView.group.userData.tile = { x: game.player.x, y: game.player.y }
    this.animatePlayer(now, dt)

    // NPCs: lazily created, hp bar when damaged; a brief corpse animation
    // (fall + sink) keeps the mesh visible right after death.
    for (const npc of game.npcs) {
      const view = this.npcView(npc)
      const dying = !npc.alive && now - view.diedAt < DEATH_TOTAL_MS
      view.group.visible = npc.alive || dying
      if (!view.group.visible) continue
      const pos = this.moverPos(npc, npc.x, npc.y)
      view.group.position.set(pos.x + 0.5, 0, pos.y + 0.5)
      view.group.userData.tile = { x: npc.x, y: npc.y }
      if (npc.alive) {
        updateHealthBar(view, npc.currentHp, npc.def.combat.hitpoints, this.camera.quaternion)
      } else {
        view.hpBar.visible = false
      }
      this.animateNpc(npc, view, now, dt, dying)
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

    this.updateHitsplats(now)
  }

  /** World XZ (tile center) of an entity's current interpolated position. */
  private entityWorldPos(key: object, x: number, y: number): { x: number; z: number } {
    const pos = this.moverPos(key, x, y)
    return { x: pos.x + 0.5, z: pos.y + 0.5 }
  }

  /**
   * Spawn a floating damage number over an entity: `npc` for a player hit,
   * or null to place it above the player (NPC hit). Damage 0 renders the blue
   * OSRS "miss" splat. It anchors just above the NPC's health bar (or a fixed
   * height over the player) and is tracked in `hitsplats` until it fades.
   */
  private spawnHitsplat(npc: Npc | null, damage: number, at: number): void {
    const baseHeight = npc
      ? this.npcView(npc).hpBar.position.y + NPC_HITSPLAT_OFFSET
      : PLAYER_HITSPLAT_HEIGHT
    const view = createHitsplat(damage, baseHeight, at)
    const start = npc
      ? this.entityWorldPos(npc, npc.x, npc.y)
      : this.entityWorldPos(this.game.player, this.game.player.x, this.game.player.y)
    this.hitsplatRoot.add(view.sprite)
    this.hitsplats.push({ view, npc, x: start.x, z: start.z })
  }

  /**
   * Follow, rise/fade and reap the live hitsplats. Player splats track the
   * player; NPC splats track the NPC while alive and freeze at their last
   * spot once it dies/despawns (so they don't jump to a respawn tile).
   */
  private updateHitsplats(now: number): void {
    for (let i = this.hitsplats.length - 1; i >= 0; i--) {
      const h = this.hitsplats[i]
      if (!h.npc) {
        const p = this.entityWorldPos(this.game.player, this.game.player.x, this.game.player.y)
        h.x = p.x
        h.z = p.z
      } else if (h.npc.alive) {
        const p = this.entityWorldPos(h.npc, h.npc.x, h.npc.y)
        h.x = p.x
        h.z = p.z
      }
      if (!updateHitsplat(h.view, now, h.x, h.z)) {
        this.hitsplatRoot.remove(h.view.sprite)
        disposeHitsplat(h.view)
        this.hitsplats.splice(i, 1)
      }
    }
  }

  /**
   * Pick the player's pose + facing from engine state and drive the
   * skeleton. Priority: death fall > walking (tick interpolation still in
   * progress) > current action (via its `kind` descriptor) > open bank >
   * idle. Facing turns toward the movement direction or the action's
   * target tile; flinch/attack-swing overlays come from engine events.
   */
  private animatePlayer(now: number, dt: number): void {
    const player = this.game.player
    const state = this.movers.get(player)
    const t = clamp((now - this.lastTickAt) / TICK_MS, 0, 1)
    const walking = !!state && t < 1 && (state.px !== state.cx || state.py !== state.cy)
    const dying = now - this.diedAt < DEATH_TOTAL_MS

    let pose: PlayerPose = 'idle'
    let faceTarget: number | null = null
    if (dying) {
      pose = 'death'
    } else if (walking && state) {
      pose = 'walk'
      faceTarget = yawToward({ x: state.px, y: state.py }, { x: state.cx, y: state.cy })
    } else if (player.action?.kind) {
      pose = ACTION_POSE[player.action.kind]
      const target = player.action.targetPosition
      if (target) faceTarget = yawToward(player.position, target)
    } else if (this.game.bank.isOpen || this.game.shop.isOpen) {
      pose = 'bank'
    }
    if (faceTarget !== null) {
      this.playerYaw = approachAngle(this.playerYaw, faceTarget, TURN_SPEED * dt)
    }

    updatePlayerAnimation(this.playerView, {
      pose,
      now,
      tickPhase: t,
      yaw: this.playerYaw,
      flinch: dying ? 0 : decay01(now, this.lastHurtAt, FLINCH_MS),
      death: dying ? Math.min(1, (now - this.diedAt) / DEATH_FALL_MS) : 0,
      attackSwing: progress01(now, this.lastAttackAt, ATTACK_SWING_MS),
    })
  }

  /** The lazily-created view (mesh + animation state) for an NPC. */
  private npcView(npc: Npc): NpcView {
    let view = this.npcViews.get(npc)
    if (!view) {
      view = createNpcMesh(this.resources, npc)
      this.npcViews.set(npc, view)
      this.dynamicRoot.add(view.group)
    }
    return view
  }

  /**
   * Pick an NPC's pose + facing from engine state and drive its parts.
   * Priority: death fall > walking (tick interpolation in progress, facing
   * the movement direction) > combat stance facing its target > idle.
   * Flinch/attack-lunge overlays come from the damageDealt events.
   */
  private animateNpc(npc: Npc, view: NpcView, now: number, dt: number, dying: boolean): void {
    const state = this.movers.get(npc)
    const t = clamp((now - this.lastTickAt) / TICK_MS, 0, 1)
    const walking =
      npc.alive && !!state && t < 1 && (state.px !== state.cx || state.py !== state.cy)

    let pose: NpcPose = 'idle'
    let faceTarget: number | null = null
    if (dying) {
      pose = 'death'
    } else if (walking && state) {
      pose = 'walk'
      faceTarget = yawToward({ x: state.px, y: state.py }, { x: state.cx, y: state.cy })
    } else if (npc.target) {
      pose = 'combat'
      faceTarget = yawToward(npc.position, npc.target.position)
    }
    if (faceTarget !== null) {
      view.yaw = approachAngle(view.yaw, faceTarget, TURN_SPEED * dt)
    }

    updateNpcAnimation(view, {
      pose,
      now,
      tickPhase: t,
      yaw: view.yaw,
      flinch: dying ? 0 : decay01(now, view.lastHurtAt, FLINCH_MS),
      death: dying ? Math.min(1, (now - view.diedAt) / DEATH_FALL_MS) : 0,
      attackSwing: progress01(now, view.lastAttackAt, ATTACK_SWING_MS),
    })
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
      [this.dynamicRoot, this.groundMesh, this.waterMesh, this.stoneMesh],
      true,
    )
    for (const hit of hits) {
      if (hit.object === this.groundMesh && hit.instanceId !== undefined) {
        return this.groundTiles[hit.instanceId] ?? null
      }
      if (hit.object === this.waterMesh && hit.instanceId !== undefined) {
        return this.waterTiles[hit.instanceId] ?? null
      }
      if (hit.object === this.stoneMesh && hit.instanceId !== undefined) {
        return this.stoneTiles[hit.instanceId] ?? null
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
    // Raised stone tiles get the outline on their top face; flat grass/water
    // tiles keep it just above the ground to avoid z-fighting.
    const onWall = this.stoneTileKeys.has(hover.y * this.game.world.width + hover.x)
    this.hoverMesh.position.set(hover.x + 0.5, onWall ? 0.85 : 0.04, hover.y + 0.5)
  }

  /** Stop the rAF loop, detach listeners and free all GPU resources. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.unsubscribeTick()
    for (const unsubscribe of this.unsubscribeAnimEvents) unsubscribe()
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    this.canvas.removeEventListener('touchmove', this.onTouchMove)
    this.canvas.removeEventListener('touchend', this.onTouchEnd)
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    for (const h of this.hitsplats) {
      this.hitsplatRoot.remove(h.view.sprite)
      disposeHitsplat(h.view)
    }
    this.hitsplats.length = 0
    this.resources.dispose()
    this.groundMesh.dispose()
    this.waterMesh.dispose()
    this.stoneMesh.dispose()
    this.renderer.dispose()
  }
}
