import type { MapDef } from '../../content/types'
import { Player } from '../entities/player'
import { World } from '../world/tileMap'
import type { Vec2 } from '../world/vec2'
import { EventBus } from './eventBus'
import { Rng } from './rng'

/**
 * Duration of one game tick in milliseconds (OSRS-style). The UI drives
 * ticks in real time with this constant; the engine never schedules timers.
 */
export const TICK_MS = 600

export interface GameConfig {
  seed: number
  map: MapDef
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
    this.player.update(this)
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
