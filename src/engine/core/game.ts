import type { MapDef } from '../../content/types'
import { getNpcDef, Npc, type NpcSave } from '../entities/npc'
import { Player, type PlayerSave } from '../entities/player'
import { Bank, type BankSave } from '../systems/bank'
import { FireManager, type FireSave } from '../systems/firemaking'
import { Shop } from '../systems/shop'
import { FarmPatch, type FarmPatchSave, getFarmPatchDef } from '../world/farmPatch'
import { GroundItemManager, type GroundItemsSave } from '../world/groundItems'
import { getResourceNodeDef, ResourceNode, type ResourceNodeSave } from '../world/resourceNode'
import { World } from '../world/tileMap'
import type { Vec2 } from '../world/vec2'
import { getWorldObjectDef, WorldObject } from '../world/worldObject'
import { EventBus } from './eventBus'
import { Rng } from './rng'

/**
 * Duration of one game tick in milliseconds (OSRS-style). The UI drives
 * ticks in real time with this constant; the engine never schedules timers.
 */
export const TICK_MS = 600

/** Boosted/drained stats move 1 point toward base this often (1 minute). */
export const STAT_RESTORE_INTERVAL_TICKS = 100

/** Placement of a resource node on the map, resolved by def id. */
export interface NodePlacement {
  defId: string
  x: number
  y: number
}

/** Placement of an NPC spawn on the map, resolved by def id. */
export interface NpcPlacement {
  defId: string
  x: number
  y: number
}

/** Placement of a world object (bank booth, range), resolved by def id. */
export interface ObjectPlacement {
  defId: string
  x: number
  y: number
}

/** Placement of a farm patch on the map, resolved by def id. */
export interface PatchPlacement {
  defId: string
  x: number
  y: number
}

export interface GameConfig {
  seed: number
  map: MapDef
  /** Resource nodes to place at startup (also addable via world.addNode). */
  nodes?: NodePlacement[]
  /** NPCs to spawn at startup (spawn tiles must be walkable). */
  npcs?: NpcPlacement[]
  /** World objects to place at startup (also addable via world.addObject). */
  objects?: ObjectPlacement[]
  /** Farm patches to place at startup (also addable via world.addPatch). */
  patches?: PatchPlacement[]
}

/**
 * Version of the GameSave format. Bump on any breaking change to the save
 * shape. Older saves are upgraded by stepwise migrations (see
 * setup/migrations.ts) before Game.restore runs, so bumping this must be
 * paired with a migration from the previous version.
 *
 * History:
 * - 1: initial format.
 * - 2: added `patches` (persistent farm-patch crop state). v1 saves migrate
 *   by adding an empty `patches: []` (a v1 world had no planted crops).
 * - 3: added `player.runEnergy` (run-energy/Agility system). v2 saves migrate
 *   by defaulting the player to a full energy tank (100%).
 */
export const SAVE_FORMAT_VERSION = 3

/**
 * Plain JSON-safe snapshot of a whole game (see Game.serialize). Nodes and
 * NPCs are saved positionally: the arrays line up index-for-index with the
 * placements the Game was constructed from, so a save only restores into a
 * Game built from the same config (createNewGame).
 *
 * Deliberately dropped on save: the player's movement queue and in-progress
 * action (loads idle), NPC combat targets (re-aggro naturally), and any
 * open bank/shop interface (loads closed).
 */
export interface GameSave {
  version: number
  seed: number
  tick: number
  rngState: number
  player: PlayerSave
  bank: BankSave
  nodes: ResourceNodeSave[]
  npcs: NpcSave[]
  groundItems: GroundItemsSave
  fires: FireSave[]
  /**
   * Persistent farm-patch crop state, saved positionally (index-for-index
   * with the patch placements the Game was built from). Restored leniently:
   * patches missing from the save (e.g. a migrated v1 save with `patches: []`)
   * keep their default unplanted state. Added in save format v2.
   */
  patches: FarmPatchSave[]
}

/**
 * Composition root of the engine. Fully deterministic: the same seed and the
 * same command sequence always produce the same state. Tests call `tick()`
 * manually; the UI calls it every TICK_MS.
 */
export class Game {
  /** Seed the game was constructed with (recorded in saves). */
  readonly seed: number
  readonly rng: Rng
  readonly events: EventBus
  readonly world: World
  readonly player: Player
  readonly npcs: Npc[] = []
  readonly groundItems: GroundItemManager
  readonly fires: FireManager
  readonly bank: Bank
  readonly shop: Shop
  /** Player spawn tile (also the death respawn point). */
  readonly spawn: Readonly<Vec2>

  private _tickCount = 0

  constructor(config: GameConfig) {
    this.seed = config.seed
    this.rng = new Rng(config.seed)
    this.events = new EventBus()
    this.world = new World(config.map)
    this.groundItems = new GroundItemManager(this.events)
    this.fires = new FireManager(this.events)
    // Place nodes/objects before spawning so blocking affects spawn checks.
    for (const { defId, x, y } of config.nodes ?? []) {
      this.world.addNode(new ResourceNode(getResourceNodeDef(defId), { x, y }))
    }
    for (const { defId, x, y } of config.objects ?? []) {
      this.world.addObject(new WorldObject(getWorldObjectDef(defId), { x, y }))
    }
    // Farm patches block movement (like nodes/objects), so place them before
    // spawn resolution too.
    for (const { defId, x, y } of config.patches ?? []) {
      this.world.addPatch(new FarmPatch(getFarmPatchDef(defId), { x, y }))
    }
    for (const { defId, x, y } of config.npcs ?? []) {
      if (!this.world.isWalkable(x, y)) {
        throw new Error(`Npc "${defId}": spawn (${x}, ${y}) is not walkable`)
      }
      this.npcs.push(new Npc(getNpcDef(defId), { x, y }))
    }
    this.spawn = resolveSpawn(config.map, this.world)
    this.player = new Player(
      this.world,
      this.events,
      this.spawn,
      this.fires,
      this.groundItems,
      () => this._tickCount,
    )
    this.bank = new Bank(this.events, this.player.inventory)
    this.shop = new Shop(this.events, this.player.inventory)
    // Only one interface may be open at a time (OSRS-style).
    this.events.on('bankOpened', () => this.shop.close())
    this.events.on('shopOpened', () => this.bank.close())
  }

  get tickCount(): number {
    return this._tickCount
  }

  /**
   * Snapshot the full mutable game state as a plain JSON-safe object.
   * Pure: no clocks, no storage — persistence is the caller's concern
   * (the UI writes it to localStorage). See GameSave for what is dropped.
   */
  serialize(): GameSave {
    return {
      version: SAVE_FORMAT_VERSION,
      seed: this.seed,
      tick: this._tickCount,
      rngState: this.rng.getState(),
      player: this.player.serialize(),
      bank: this.bank.serialize(),
      nodes: this.world.nodes.map((node) => node.serialize()),
      npcs: this.npcs.map((npc) => npc.serialize()),
      groundItems: this.groundItems.serialize(),
      fires: this.fires.serialize(),
      patches: this.world.patches.map((patch) => patch.serialize()),
    }
  }

  /**
   * Restore a snapshot from `serialize()` into this Game. The Game must
   * have been built from the same config the save came from (node/npc
   * arrays are matched by index). Restoring the Rng state preserves
   * determinism: original and loaded games evolve identically. Throws on
   * version or world-shape mismatches and invalid content ids; callers
   * (setup/loadGame.ts) treat that as an incompatible save.
   *
   * The save must already be at the current SAVE_FORMAT_VERSION — older saves
   * are upgraded by setup/migrations.ts before reaching here. Patch state is
   * restored LENIENTLY (positionally, up to the shorter of the two arrays):
   * patches absent from the save (e.g. a migrated v1 save with `patches: []`)
   * keep their default unplanted state, so a patch-count mismatch is fine.
   */
  restore(save: GameSave): void {
    if (save.version !== SAVE_FORMAT_VERSION) {
      throw new Error(
        `Game.restore: save version ${save.version} != ${SAVE_FORMAT_VERSION}`,
      )
    }
    if (save.nodes.length !== this.world.nodes.length || save.npcs.length !== this.npcs.length) {
      throw new Error('Game.restore: save does not match this world (node/npc count mismatch)')
    }
    this._tickCount = save.tick
    this.rng.setState(save.rngState)
    this.world.nodes.forEach((node, i) => node.restore(save.nodes[i]))
    this.npcs.forEach((npc, i) => npc.restore(save.npcs[i]))
    this.groundItems.restore(save.groundItems)
    this.fires.restore(save.fires)
    // Lenient positional patch restore: any patch not present in the save
    // (migrated v1 saves have none) stays in its default unplanted state.
    const patchSaves = save.patches ?? []
    const patchCount = Math.min(patchSaves.length, this.world.patches.length)
    for (let i = 0; i < patchCount; i++) {
      this.world.patches[i].restore(patchSaves[i])
    }
    this.player.restore(save.player)
    this.bank.restore(save.bank)
  }

  /**
   * Advance the game by exactly one tick, in a fixed order so runs are
   * deterministic:
   *
   * 1. bump the tick counter;
   * 2. respawn depleted nodes (so a node due this tick is gatherable);
   * 3. grow every farm patch by one tick (so a crop maturing this tick is
   *    harvestable this tick);
   * 4. expire burnt-out fires (so a fire due this tick is no longer a
   *    valid cooking source this tick);
   * 5. update the player (movement / current action, incl. attacks);
   * 6. drain active prayers (deterministic, tick-driven; may switch prayers
   *    off when prayer points run out);
   * 7. update NPCs in spawn order (wander / chase / attack);
   * 8. respawn dead NPCs whose timer has elapsed (they act next tick);
   * 9. despawn expired ground items;
   * 10. natural stat restore, then emit `tick` so listeners observe
   *    settled state.
   */
  tick(): void {
    this._tickCount++
    for (const node of this.world.nodes) {
      if (node.depleted && this._tickCount >= node.respawnAtTick) {
        node.respawn()
        const { x, y } = node.position
        this.events.emit('nodeRespawned', { nodeId: node.def.id, x, y })
      }
    }
    for (const patch of this.world.patches) {
      if (patch.grow()) {
        this.events.emit('cropGrew', {
          patchId: patch.def.id,
          seedId: patch.plantedSeedId as string,
          stage: patch.stage,
        })
      }
    }
    this.fires.expireDue(this._tickCount)
    this.player.update(this)
    this.player.prayers.drain(this.player.skills)
    for (const npc of this.npcs) {
      npc.update(this)
    }
    for (const npc of this.npcs) {
      if (!npc.alive && this._tickCount >= npc.respawnAtTick) {
        npc.respawn()
        this.events.emit('npcRespawned', { npcId: npc.def.id, x: npc.x, y: npc.y })
      }
    }
    this.groundItems.despawnDue(this._tickCount)
    // Natural stat restore: 1 point toward base per minute (100 ticks).
    if (this._tickCount % STAT_RESTORE_INTERVAL_TICKS === 0) {
      this.player.skills.restoreTowardBase()
    }
    this.events.emit('tick', { tick: this._tickCount })
  }
}

function resolveSpawn(map: MapDef, world: World): Vec2 {
  if (map.spawn) {
    if (!world.isWalkable(map.spawn.x, map.spawn.y)) {
      throw new Error(`Map "${map.id}": spawn (${map.spawn.x}, ${map.spawn.y}) is not walkable`)
    }
    return { x: map.spawn.x, y: map.spawn.y }
  }
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.isWalkable(x, y)) return { x, y }
    }
  }
  throw new Error(`Map "${map.id}" has no walkable tiles`)
}
