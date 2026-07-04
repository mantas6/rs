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
// the separable render concerns (orbit camera, tick interpolation, entity
// pose selection, hitsplats, tile info) live in src/ui/render/. This class
// only orchestrates: scene setup, lighting, picking and per-frame sync,
// wiring those modules together.
import * as THREE from 'three'
import type { Fire, Game, GroundItem, Npc, ResourceNode } from '../engine'
import type { FarmPatch } from '../engine'
import { getFarmingCrop } from '../engine'
import {
  createAnvilMesh,
  createBankBoothMesh,
  createBarCounterMesh,
  createBuildings,
  createCookingRangeMesh,
  createFarmPatchMesh,
  createFireMesh,
  createFishingSpotMesh,
  createFurnaceMesh,
  createGroundItemMesh,
  createGroundTiles,
  createHitsplat,
  createHoverOutline,
  createNpcMesh,
  createPlayerMesh,
  createRockMesh,
  createScenery,
  createShopCounterMesh,
  createTreeMesh,
  decay01,
  updateFarmPatchGrowth,
  type BuildingsView,
  type FarmPatchView,
  progress01,
  SpriteResources,
  tileGroup,
  updateFireFlicker,
  updateFishingSpotPulse,
  updateGroundItemSpin,
  updateHealthBar,
  updateNpcAnimation,
  updatePlayerAnimation,
  updatePlayerEquipment,
  updateWaterRipple,
  approachAngle,
  type SceneryView,
  type WaterAnimation,
  type NpcView,
  type PlayerView,
} from './sprites'
import { CameraController } from './render/cameraController'
import {
  ATTACK_SWING_MS,
  DEATH_FALL_MS,
  DEATH_TOTAL_MS,
  FLINCH_MS,
  NPC_HITSPLAT_OFFSET,
  PLAYER_HITSPLAT_HEIGHT,
  TURN_SPEED,
  VIEW_H,
  VIEW_W,
  type Hover,
} from './render/constants'
import { selectNpcPose, selectPlayerPose } from './render/entityAnimation'
import { HitsplatManager } from './render/hitsplats'
import { MoverInterpolator } from './render/interpolation'

// Re-export the renderer's public surface from its original module path so
// existing imports (GameCanvas.tsx and others) keep resolving unchanged.
export { VIEW_H, VIEW_W, type Hover } from './render/constants'
export { describeTile, npcCombatLevel } from './render/tileInfo'

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
  private readonly cameraController: CameraController
  private readonly raycaster = new THREE.Raycaster()

  // Shared sprite resources, tracked so dispose() can free GPU memory.
  private readonly resources = new SpriteResources()

  // Static ground meshes plus instance-index → tile lookup for picking.
  // Grass + water are flat planes; stone walls are raised boxes.
  private groundMesh!: THREE.InstancedMesh
  private floorMesh!: THREE.InstancedMesh
  private waterMesh!: THREE.InstancedMesh
  private stoneMesh!: THREE.InstancedMesh
  private groundTiles: Hover[] = []
  private floorTiles: Hover[] = []
  private waterTiles: Hover[] = []
  private stoneTiles: Hover[] = []
  /** Keys (y*width + x) of raised stone tiles, for the hover-outline height. */
  private stoneTileKeys = new Set<number>()
  private waterAnim!: WaterAnimation

  /** Root for everything pickable that carries userData.tile. */
  private readonly dynamicRoot = new THREE.Group()

  // Purely decorative foliage + fences. Added straight to the scene (never to
  // the pick list), so clicks pass through to the ground tile beneath.
  private scenery!: SceneryView

  // Building layer (thatch roofs + dressed walls + door frames), non-pickable.
  // `buildingRoofs` are toggled visible per frame for OSRS-style roof removal.
  private buildings!: BuildingsView
  private buildingRoofs: THREE.Mesh[] = []

  // Per-engine-object views, synced against engine state every frame.
  private playerView!: PlayerView
  private readonly npcViews = new Map<Npc, NpcView>()
  private readonly nodeViews = new Map<ResourceNode, NodeView>()
  private readonly patchViews = new Map<FarmPatch, FarmPatchView>()
  private readonly fireViews = new Map<Fire, THREE.Group>()
  private readonly itemViews = new Map<GroundItem, THREE.Object3D>()
  private hoverMesh!: THREE.LineLoop

  // Floating damage numbers, owned by their own manager (never pickable).
  private readonly hitsplats = new HitsplatManager()

  // Tick interpolation state.
  private readonly interp = new MoverInterpolator()
  private readonly unsubscribeTick: () => void

  // Player animation state (purely visual, driven by engine events/state).
  private playerYaw = Math.PI
  private lastHurtAt = -Infinity
  private lastAttackAt = -Infinity
  private diedAt = -Infinity
  private readonly unsubscribeAnimEvents: Array<() => void> = []

  // Keeps the renderer/camera matched to the canvas container's box.
  private readonly resizeObserver: ResizeObserver

  private rafId = 0
  private lastFrameAt = performance.now()
  private disposed = false

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

    this.cameraController = new CameraController(canvas, initialW / initialH)

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
    this.buildPatches()
    this.buildScenery()
    this.buildBuildings()
    this.playerView = createPlayerMesh(this.resources, game.player.x, game.player.y)
    this.dynamicRoot.add(this.playerView.group)
    // Build worn-gear visuals from the current (possibly save-restored)
    // equipment, then keep them in sync whenever a slot changes.
    this.syncPlayerEquipment()
    this.unsubscribeAnimEvents.push(
      game.events.on('equipmentChanged', () => this.syncPlayerEquipment()),
    )

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
    this.scene.add(this.hitsplats.root)

    // Snapshot mover positions once per engine tick for interpolation.
    this.unsubscribeTick = game.events.on('tick', () => this.snapshotMovers())
    this.snapshotMovers()

    this.cameraController.attach()

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
    this.floorMesh = ground.floorMesh
    this.waterMesh = ground.waterMesh
    this.stoneMesh = ground.stoneMesh
    this.groundTiles = ground.groundTiles
    this.floorTiles = ground.floorTiles
    this.waterTiles = ground.waterTiles
    this.stoneTiles = ground.stoneTiles
    this.waterAnim = ground.water
    const width = this.game.world.width
    this.stoneTileKeys = new Set(this.stoneTiles.map((t) => t.y * width + t.x))
    this.scene.add(this.groundMesh, this.floorMesh, this.waterMesh, this.stoneMesh)
  }

  /** Bank booths, shop counters, cooking ranges, furnaces and anvils on their tiles. */
  private buildStaticObjects(): void {
    for (const object of this.game.world.objects) {
      const { x, y } = object.position
      const group = object.def.bank
        ? createBankBoothMesh(this.resources, x, y)
        : object.def.id === 'bar_counter'
          ? createBarCounterMesh(this.resources, x, y)
          : object.def.shop
            ? createShopCounterMesh(this.resources, x, y)
            : object.def.smeltingSource
              ? createFurnaceMesh(this.resources, x, y)
              : object.def.anvilSource
                ? createAnvilMesh(this.resources, x, y)
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

  /** Allotment farm patches: tilled soil with a crop that grows over time. */
  private buildPatches(): void {
    for (const patch of this.game.world.patches) {
      const view = createFarmPatchMesh(this.resources, patch.position.x, patch.position.y)
      this.dynamicRoot.add(view.group)
      this.patchViews.set(patch, view)
    }
  }

  /**
   * Decorative foliage + riverbank fences, deterministically scattered from
   * the classified terrain. Added to the scene (not dynamicRoot) so it is
   * never in the pick ray list — decorations can't intercept clicks.
   */
  private buildScenery(): void {
    this.scenery = createScenery(
      this.resources,
      this.game.world,
      this.groundTiles,
      this.floorTiles,
      this.waterTiles,
      this.stoneTiles,
    )
    this.scene.add(this.scenery.group)
  }

  /**
   * Buildings: pitched thatch roofs, timber-framed plaster walls and door
   * frames, derived from the same floored-room set as the terrain. Added to
   * the scene (not dynamicRoot), so clicks pass through to the pickable
   * stone/floor tiles beneath and the roofs never intercept walk-to. Each roof
   * is kept so syncScene can hide the one the player is standing under.
   */
  private buildBuildings(): void {
    this.buildings = createBuildings(this.resources, this.game.world)
    this.buildingRoofs = this.buildings.roofs
    this.scene.add(this.buildings.group)
  }

  // ---- Tick interpolation ----

  /** Shift current → previous for every mover; runs once per engine tick. */
  private snapshotMovers(): void {
    this.interp.snapshotMovers(this.game.player, this.game.npcs)
  }

  // ---- Per-frame sync + render ----

  private renderFrame(): void {
    const now = performance.now()
    const dt = Math.min((now - this.lastFrameAt) / 1000, 0.1)
    this.lastFrameAt = now

    this.syncScene(now, dt)
    this.updateCamera(dt)
    this.renderer.render(this.scene, this.cameraController.camera)
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
    this.cameraController.setAspect(width, height)
    this.renderFrame()
  }

  private syncScene(now: number, dt: number): void {
    const game = this.game

    // Drift the water surface so the river looks like it flows.
    updateWaterRipple(this.waterAnim, now)

    // Gentle time-based sway for the foliage (one shared uniform write).
    this.scenery.sway.value = now / 1000

    // OSRS-style roof removal: hide the roof of the building the player is
    // currently standing inside so the interior stays visible.
    if (this.buildingRoofs.length > 0) {
      const playerKey = game.player.y * game.world.width + game.player.x
      for (const roof of this.buildingRoofs) {
        const footprint = roof.userData.footprint as Set<number> | undefined
        roof.visible = !footprint?.has(playerKey)
      }
    }

    // Player.
    const p = this.interp.moverPos(game.player, game.player.x, game.player.y)
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
      const pos = this.interp.moverPos(npc, npc.x, npc.y)
      view.group.position.set(pos.x + 0.5, 0, pos.y + 0.5)
      view.group.userData.tile = { x: npc.x, y: npc.y }
      if (npc.alive) {
        updateHealthBar(
          view,
          npc.currentHp,
          npc.def.combat.hitpoints,
          this.cameraController.camera.quaternion,
        )
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

    // Farm patches: grow the crop foliage as it matures; ripen when grown.
    for (const [patch, view] of this.patchViews) {
      const seedId = patch.plantedSeedId
      const progress = seedId ? patch.stage / getFarmingCrop(seedId).growthStages : 0
      updateFarmPatchGrowth(view, patch.isPlanted, progress, patch.isGrown())
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

    // Ground items: per-item 3D models that slowly spin and bob on their tile.
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

  /**
   * Spawn a floating damage number over an entity: `npc` for a player hit,
   * or null to place it above the player (NPC hit). Damage 0 renders the blue
   * OSRS "miss" splat. It anchors just above the NPC's health bar (or a fixed
   * height over the player) and is tracked until it fades.
   */
  private spawnHitsplat(npc: Npc | null, damage: number, at: number): void {
    const baseHeight = npc
      ? this.npcView(npc).hpBar.position.y + NPC_HITSPLAT_OFFSET
      : PLAYER_HITSPLAT_HEIGHT
    const view = createHitsplat(damage, baseHeight, at)
    const start = npc
      ? this.interp.entityWorldPos(npc, npc.x, npc.y)
      : this.interp.entityWorldPos(this.game.player, this.game.player.x, this.game.player.y)
    this.hitsplats.add(view, npc, start.x, start.z)
  }

  /** Follow, rise/fade and reap the live hitsplats. */
  private updateHitsplats(now: number): void {
    this.hitsplats.update(
      now,
      () =>
        this.interp.entityWorldPos(this.game.player, this.game.player.x, this.game.player.y),
      (npc) => this.interp.entityWorldPos(npc, npc.x, npc.y),
    )
  }

  /**
   * Pick the player's pose + facing from engine state and drive the
   * skeleton (see selectPlayerPose). Facing turns toward the movement
   * direction or the action's target tile; flinch/attack-swing overlays come
   * from engine events.
   */
  private animatePlayer(now: number, dt: number): void {
    const player = this.game.player
    const state = this.interp.mover(player)
    const t = this.interp.tickPhase(now)
    const walking = !!state && t < 1 && (state.px !== state.cx || state.py !== state.cy)
    const dying = now - this.diedAt < DEATH_TOTAL_MS

    const { pose, faceTarget } = selectPlayerPose({
      dying,
      walking,
      state,
      actionKind: player.action?.kind,
      actionTarget: player.action?.targetPosition,
      playerPosition: player.position,
      bankOpen: this.game.bank.isOpen,
      shopOpen: this.game.shop.isOpen,
    })
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

  /**
   * Rebuild the player's worn-gear meshes from the engine's current
   * equipment. Reuses cached geometries/materials (SpriteResources), so
   * re-running it on every equip/unequip never leaks GPU memory.
   */
  private syncPlayerEquipment(): void {
    const equipment = this.game.player.equipment
    updatePlayerEquipment(
      this.resources,
      this.playerView,
      (slot) => equipment.get(slot)?.itemId ?? null,
    )
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
   * Pick an NPC's pose + facing from engine state and drive its parts (see
   * selectNpcPose). Flinch/attack-lunge overlays come from the damageDealt
   * events.
   */
  private animateNpc(npc: Npc, view: NpcView, now: number, dt: number, dying: boolean): void {
    const state = this.interp.mover(npc)
    const t = this.interp.tickPhase(now)
    const walking =
      npc.alive && !!state && t < 1 && (state.px !== state.cx || state.py !== state.cy)

    const { pose, faceTarget } = selectNpcPose({
      dying,
      walking,
      state,
      targetPosition: npc.target?.position ?? null,
      npcPosition: npc.position,
    })
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
    const p = this.interp.moverPos(this.game.player, this.game.player.x, this.game.player.y)
    this.cameraController.update(dt, p.x, p.y)
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
    this.raycaster.setFromCamera(ndc, this.cameraController.camera)
    const hits = this.raycaster.intersectObjects(
      [this.dynamicRoot, this.groundMesh, this.floorMesh, this.waterMesh, this.stoneMesh],
      true,
    )
    for (const hit of hits) {
      if (hit.object === this.groundMesh && hit.instanceId !== undefined) {
        return this.groundTiles[hit.instanceId] ?? null
      }
      if (hit.object === this.floorMesh && hit.instanceId !== undefined) {
        return this.floorTiles[hit.instanceId] ?? null
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
    this.cameraController.detach()
    this.hitsplats.dispose()
    this.resources.dispose()
    this.groundMesh.dispose()
    this.waterMesh.dispose()
    this.stoneMesh.dispose()
    this.renderer.dispose()
  }
}
