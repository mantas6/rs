import { firemakingDefs } from '../../content/recipes'
import type { FiremakingDef } from '../../content/types'
import type { EventBus } from '../core/eventBus'
import type { Game } from '../core/game'
import type { Player, PlayerAction } from '../entities/player'
import type { World } from '../world/tileMap'
import type { Vec2 } from '../world/vec2'
import { MAX_LEVEL } from './skills'

/** Why lighting a fire failed to start or was interrupted. */
export type FiremakingFailReason =
  | 'level_too_low'
  | 'missing_tool'
  | 'missing_ingredient'
  | 'cannot_light_here'

// Firemaking events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when a fire is lit (logs + xp already handled). */
    fireLit: { x: number; y: number; expiresAtTick: number }
    /** Emitted when a fire burns out (removed in Game.tick). */
    fireExpired: { x: number; y: number }
  }
}

/** JSON-safe snapshot of one lit fire (see FireManager.serialize). */
export interface FireSave {
  x: number
  y: number
  expiresAtTick: number
}

/** Item required in the inventory to light any fire. */
export const TINDERBOX_ITEM_ID = 'tinderbox'

/** Per-tick light chance at firemaking level 1. */
export const FIREMAKING_CHANCE_LOW = 0.4
/** Per-tick light chance at firemaking level 99. */
export const FIREMAKING_CHANCE_HIGH = 1

/**
 * Firemaking lookup for engine code. Content stays data-only; this is the
 * engine's typed gateway into the record (mirrors itemRegistry).
 */
export function getFiremakingDef(logsItemId: string): FiremakingDef {
  const def = firemakingDefs[logsItemId]
  if (!def) throw new Error(`Unknown firemaking logs id: ${logsItemId}`)
  return def
}

/**
 * Per-tick chance that the logs catch: linear interpolation between
 * FIREMAKING_CHANCE_LOW (level 1) and FIREMAKING_CHANCE_HIGH (level 99),
 * same shape as the gathering success formula.
 */
export function lightFireChance(level: number): number {
  const clamped = Math.min(Math.max(level, 1), MAX_LEVEL)
  const chance =
    (FIREMAKING_CHANCE_LOW * (MAX_LEVEL - clamped) + FIREMAKING_CHANCE_HIGH * (clamped - 1)) /
    (MAX_LEVEL - 1)
  return Math.min(1, Math.max(0, chance))
}

/**
 * A lit fire on a world tile. Fires never block movement; they expire in
 * Game.tick when the tick counter reaches `expiresAtTick`. Fires are valid
 * cooking sources until they expire (see cooking.ts).
 */
export class Fire {
  private _expired = false

  constructor(
    readonly position: Readonly<Vec2>,
    readonly expiresAtTick: number,
  ) {}

  /** True once the fire has burnt out (set by FireManager.expireDue). */
  get expired(): boolean {
    return this._expired
  }

  /** @internal Marked by FireManager when the fire is removed. */
  markExpired(): void {
    this._expired = true
  }
}

/**
 * All lit fires in the world. Owned by Game, which calls `expireDue` once
 * per tick (before entity updates, so a fire due this tick is already
 * invalid as a cooking source this tick).
 */
export class FireManager {
  private readonly _fires: Fire[] = []

  constructor(private readonly events: EventBus) {}

  /** All burning fires, in lighting order. */
  get fires(): readonly Fire[] {
    return this._fires
  }

  /** The burning fire on tile (x, y), or null. */
  fireAt(x: number, y: number): Fire | null {
    return this._fires.find((f) => f.position.x === x && f.position.y === y) ?? null
  }

  /** Light a fire on a tile (one fire per tile). Emits `fireLit`. */
  light(x: number, y: number, expiresAtTick: number): Fire {
    if (this.fireAt(x, y)) {
      throw new Error(`FireManager.light: tile (${x}, ${y}) already has a fire`)
    }
    const fire = new Fire({ x, y }, expiresAtTick)
    this._fires.push(fire)
    this.events.emit('fireLit', { x, y, expiresAtTick })
    return fire
  }

  /** JSON-safe copy of every burning fire, for save/load. */
  serialize(): FireSave[] {
    return this._fires.map((f) => ({
      x: f.position.x,
      y: f.position.y,
      expiresAtTick: f.expiresAtTick,
    }))
  }

  /**
   * Restore a snapshot from `serialize()`. Emits no events: restore runs
   * during game construction, before any listeners subscribe.
   */
  restore(save: FireSave[]): void {
    this._fires.length = 0
    for (const { x, y, expiresAtTick } of save) {
      this._fires.push(new Fire({ x, y }, expiresAtTick))
    }
  }

  /** Remove every fire whose expiry tick has been reached. */
  expireDue(tick: number): void {
    // Iterate a snapshot (in lighting order): splicing mutates the live array.
    for (const fire of [...this._fires]) {
      if (tick < fire.expiresAtTick) continue
      this._fires.splice(this._fires.indexOf(fire), 1)
      fire.markExpired()
      this.events.emit('fireExpired', { x: fire.position.x, y: fire.position.y })
    }
  }
}

/**
 * Validate that `player` may light `def`'s logs right now. Returns the
 * failure reason, or null when lighting may proceed. `at` is the tile the
 * fire would occupy (the player's tile): it must be walkable and free of
 * an existing fire.
 */
export function validateLightFire(
  player: Player,
  def: FiremakingDef,
  world: World,
  fires: FireManager,
  at: Vec2,
): FiremakingFailReason | null {
  if (!player.inventory.has(TINDERBOX_ITEM_ID)) return 'missing_tool'
  if (!player.inventory.has(def.logsItemId)) return 'missing_ingredient'
  if (player.skills.getCurrentLevel('firemaking') < def.levelRequired) return 'level_too_low'
  if (!world.isWalkable(at.x, at.y) || fires.fireAt(at.x, at.y) !== null) {
    return 'cannot_light_here'
  }
  return null
}

/**
 * Adjacent-step order tried after a fire lights: OSRS steps the player one
 * tile west; we simplify to "any adjacent walkable tile, prefer west" using
 * this fixed order (orthogonals before diagonals, like pathfinding STEPS).
 * When no adjacent tile is walkable the player stays on the fire tile.
 */
const STEP_OFF_ORDER: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: -1, dy: 0 }, // west
  { dx: 1, dy: 0 }, // east
  { dx: 0, dy: -1 }, // north
  { dx: 0, dy: 1 }, // south
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
]

/**
 * Tick-driven fire lighting on the player's current tile.
 *
 * Started via `player.lightFire(logsItemId)`, which validates and sets this
 * action (no walking — you light where you stand). Each tick: re-validate,
 * then roll `lightFireChance`. On success: consume the logs, grant xp,
 * create a Fire expiring after `burnTicks`, and step the player onto an
 * adjacent walkable tile (prefer west; see STEP_OFF_ORDER). The action ends
 * on success or validation failure.
 */
export class LightFireAction implements PlayerAction {
  readonly kind = 'firemaking'
  /** Fires are lit on the player's own tile — no facing target. */
  readonly targetPosition = null

  constructor(private readonly def: FiremakingDef) {}

  onTick(game: Game): boolean {
    const { player, events, rng, world, fires } = game
    const def = this.def

    const reason = validateLightFire(player, def, world, fires, player.position)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    const level = player.skills.getCurrentLevel('firemaking')
    if (!rng.chance(lightFireChance(level))) return true

    const { x, y } = player.position
    player.inventory.remove(def.logsItemId)
    player.skills.addXp('firemaking', def.xp)
    fires.light(x, y, game.tickCount + def.burnTicks)

    for (const { dx, dy } of STEP_OFF_ORDER) {
      if (world.isWalkable(x + dx, y + dy)) {
        player.teleport(x + dx, y + dy)
        break
      }
    }
    return false
  }
}
