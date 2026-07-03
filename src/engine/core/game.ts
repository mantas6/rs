import type { MapDef } from '../../content/types'
import { getNpcDef, Npc } from '../entities/npc'
import { Player } from '../entities/player'
import { Bank } from '../systems/bank'
import { FireManager } from '../systems/firemaking'
import { GroundItemManager } from '../world/groundItems'
import { getResourceNodeDef, ResourceNode } from '../world/resourceNode'
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

export interface GameConfig {
  seed: number
  map: MapDef
  /** Resource nodes to place at startup (also addable via world.addNode). */
  nodes?: NodePlacement[]
  /** NPCs to spawn at startup (spawn tiles must be walkable). */
  npcs?: NpcPlacement[]
  /** World objects to place at startup (also addable via world.addObject). */
  objects?: ObjectPlacement[]
}

/**
 * Composition root of the engine. Fully deterministic: the same seed and the
 * same command sequence always produce the same state. Tests call `tick()`
 * manually; the UI calls it every TICK_MS.
 */
export class Game {
  readonly rng: Rng
  readonly events: EventBus
  readonly world: World
  readonly player: Player
  readonly npcs: Npc[] = []
  readonly groundItems: GroundItemManager
  readonly fires: FireManager
  readonly bank: Bank
  /** Player spawn tile (also the death respawn point). */
  readonly spawn: Readonly<Vec2>

  private _tickCount = 0

  constructor(config: GameConfig) {
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
    for (const { defId, x, y } of config.npcs ?? []) {
      if (!this.world.isWalkable(x, y)) {
        throw new Error(`Npc "${defId}": spawn (${x}, ${y}) is not walkable`)
      }
      this.npcs.push(new Npc(getNpcDef(defId), { x, y }))
    }
    this.spawn = resolveSpawn(config.map, this.world)
    this.player = new Player(this.world, this.events, this.spawn, this.fires)
    this.bank = new Bank(this.events, this.player.inventory)
  }

  get tickCount(): number {
    return this._tickCount
  }

  /**
   * Advance the game by exactly one tick, in a fixed order so runs are
   * deterministic:
   *
   * 1. bump the tick counter;
   * 2. respawn depleted nodes (so a node due this tick is gatherable);
   * 3. expire burnt-out fires (so a fire due this tick is no longer a
   *    valid cooking source this tick);
   * 4. update the player (movement / current action, incl. attacks);
   * 5. update NPCs in spawn order (wander / chase / attack);
   * 6. respawn dead NPCs whose timer has elapsed (they act next tick);
   * 7. despawn expired ground items;
   * 8. natural stat restore, then emit `tick` so listeners observe
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
    this.fires.expireDue(this._tickCount)
    this.player.update(this)
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
