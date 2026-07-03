import type { MapDef } from '../../content/types'
import { Player } from '../entities/player'
import { getResourceNodeDef, ResourceNode } from '../world/resourceNode'
import { World } from '../world/tileMap'
import type { Vec2 } from '../world/vec2'
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

export interface GameConfig {
  seed: number
  map: MapDef
  /** Resource nodes to place at startup (also addable via world.addNode). */
  nodes?: NodePlacement[]
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

  private _tickCount = 0

  constructor(config: GameConfig) {
    this.rng = new Rng(config.seed)
    this.events = new EventBus()
    this.world = new World(config.map)
    // Place nodes before spawning so blocking nodes affect spawn validation.
    for (const { defId, x, y } of config.nodes ?? []) {
      this.world.addNode(new ResourceNode(getResourceNodeDef(defId), { x, y }))
    }
    this.player = new Player(this.world, this.events, resolveSpawn(config.map, this.world))
  }

  get tickCount(): number {
    return this._tickCount
  }

  /**
   * Advance the game by exactly one tick: bump the tick counter, update the
   * player (movement / current action), then emit the `tick` event so
   * listeners observe settled state. Later systems hook in here.
   */
  tick(): void {
    this._tickCount++
    // Respawn depleted nodes first so a node due this tick is gatherable.
    for (const node of this.world.nodes) {
      if (node.depleted && this._tickCount >= node.respawnAtTick) {
        node.respawn()
        const { x, y } = node.position
        this.events.emit('nodeRespawned', { nodeId: node.def.id, x, y })
      }
    }
    this.player.update(this)
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
