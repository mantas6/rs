import { npcs } from '../../content/npcs'
import type { DropTable, NpcDef } from '../../content/types'
import type { Game } from '../core/game'
import type { Rng } from '../core/rng'
import { performNpcAttack } from '../systems/combat'
import { GROUND_ITEM_DESPAWN_TICKS } from '../world/groundItems'
import { findPathAdjacent } from '../world/pathfinding'
import type { Vec2 } from '../world/vec2'
import { chebyshev } from '../world/vec2'
import type { Player } from './player'

/**
 * NPC lookup for engine code. Content stays data-only; this is the engine's
 * typed gateway into the npc record (mirrors itemRegistry).
 */
export function getNpcDef(id: string): NpcDef {
  const def = npcs[id]
  if (!def) throw new Error(`Unknown npc id: ${id}`)
  return def
}

/** Per-tick chance that an idle NPC takes one wander step. */
export const WANDER_CHANCE = 0.1

/** Default max Chebyshev distance from spawn while wandering. */
export const DEFAULT_WANDER_RADIUS = 5

/**
 * Aggressive NPCs acquire the player as target within this Chebyshev
 * distance. (OSRS scales aggression with combat level; simplified here.)
 */
export const AGGRO_RANGE = 3

/** NPCs give up chasing when the path to the player exceeds this length. */
export const CHASE_LIMIT = 15

/** Candidate wander steps (8-directional), indexed by one rng roll. */
const WANDER_STEPS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
]

// NPC lifecycle events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when an NPC dies (payload = death tile; drops land there). */
    npcDied: { npcId: string; x: number; y: number }
    /** Emitted when a dead NPC respawns at its spawn tile. */
    npcRespawned: { npcId: string; x: number; y: number }
  }
}

/**
 * Roll a drop table: every `always` entry drops, then ONE weighted roll is
 * made across `entries` (skipped when empty). An entry with `itemId: null`
 * is the "nothing" result. Range quantities roll uniformly (inclusive).
 * Weights must be positive integers.
 */
export function rollDrops(rng: Rng, table: DropTable): { itemId: string; quantity: number }[] {
  const drops: { itemId: string; quantity: number }[] = []
  for (const { itemId, quantity } of table.always ?? []) drops.push({ itemId, quantity })

  const totalWeight = table.entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight > 0) {
    let roll = rng.nextInt(1, totalWeight)
    for (const entry of table.entries) {
      roll -= entry.weight
      if (roll > 0) continue
      if (entry.itemId !== null) {
        const quantity = Array.isArray(entry.quantity)
          ? rng.nextInt(entry.quantity[0], entry.quantity[1])
          : entry.quantity
        drops.push({ itemId: entry.itemId, quantity })
      }
      break
    }
  }
  return drops
}

/**
 * An NPC instance placed in the world. NPCs never block walking (a small
 * OSRS-like simplification).
 *
 * Per-tick behavior (driven by Game.tick via `update`):
 * - dead: nothing (the Game respawns it once `respawnAtTick` is reached);
 * - in combat: step toward the player when not adjacent (BFS, capped at
 *   CHASE_LIMIT — beyond it the NPC gives up), attack when adjacent and
 *   the cooldown has elapsed;
 * - idle: aggro the player when aggressive and within AGGRO_RANGE,
 *   otherwise small chance to wander one random step near spawn.
 */
export class Npc {
  readonly spawnPosition: Readonly<Vec2>

  private _x: number
  private _y: number
  private _hp: number
  private _alive = true
  private _respawnAtTick = 0
  private _target: Player | null = null
  /** Tick at which this NPC may next attack (0 = immediately). */
  private nextAttackTick = 0

  constructor(
    readonly def: NpcDef,
    position: Vec2,
  ) {
    this.spawnPosition = { x: position.x, y: position.y }
    this._x = position.x
    this._y = position.y
    this._hp = def.combat.hitpoints
  }

  get x(): number {
    return this._x
  }

  get y(): number {
    return this._y
  }

  get position(): Vec2 {
    return { x: this._x, y: this._y }
  }

  get currentHp(): number {
    return this._hp
  }

  get alive(): boolean {
    return this._alive
  }

  /** Tick at which the NPC respawns. Only meaningful while dead. */
  get respawnAtTick(): number {
    return this._respawnAtTick
  }

  get target(): Player | null {
    return this._target
  }

  setTarget(target: Player | null): void {
    this._target = target
  }

  /**
   * Apply damage, capped at remaining hp. Returns the damage actually
   * dealt (combat xp is granted on this capped amount).
   */
  takeDamage(amount: number): number {
    const dealt = Math.min(Math.max(amount, 0), this._hp)
    this._hp -= dealt
    return dealt
  }

  /** Advance one tick. Called by Game.tick after the player update. */
  update(game: Game): void {
    if (!this._alive) return
    if (this._target !== null) {
      this.combatTick(game)
      return
    }
    if (
      this.def.combat.aggressive &&
      chebyshev(this.position, game.player.position) <= AGGRO_RANGE
    ) {
      this._target = game.player
      this.combatTick(game)
      return
    }
    this.wanderTick(game)
  }

  /**
   * Kill this NPC: emit `npcDied`, drop rolled loot on the death tile, and
   * schedule the respawn. Called by combat when hp reaches 0.
   */
  die(game: Game): void {
    this._alive = false
    this._hp = 0
    this._target = null
    this._respawnAtTick = game.tickCount + this.def.respawnTicks
    game.events.emit('npcDied', { npcId: this.def.id, x: this._x, y: this._y })
    for (const { itemId, quantity } of rollDrops(game.rng, this.def.drops)) {
      game.groundItems.add(
        itemId,
        quantity,
        this._x,
        this._y,
        game.tickCount + GROUND_ITEM_DESPAWN_TICKS,
      )
    }
  }

  /**
   * Bring the NPC back at its spawn tile with full hp. Called by Game.tick
   * once the respawn tick is reached (the Game emits `npcRespawned`).
   */
  respawn(): void {
    this._alive = true
    this._hp = this.def.combat.hitpoints
    this._x = this.spawnPosition.x
    this._y = this.spawnPosition.y
    this._respawnAtTick = 0
    this.nextAttackTick = 0
  }

  private combatTick(game: Game): void {
    const player = game.player
    if (chebyshev(this.position, player.position) > 1) {
      const path = findPathAdjacent(game.world, this.position, player.position)
      if (path === null || path.length > CHASE_LIMIT) {
        this._target = null
        return
      }
      if (path.length > 0) {
        this._x = path[0].x
        this._y = path[0].y
      }
      return
    }
    if (game.tickCount < this.nextAttackTick) return
    this.nextAttackTick = game.tickCount + this.def.combat.attackSpeed
    performNpcAttack(game, this)
  }

  private wanderTick(game: Game): void {
    if (!game.rng.chance(WANDER_CHANCE)) return
    const step = WANDER_STEPS[game.rng.nextInt(0, WANDER_STEPS.length - 1)]
    const next = { x: this._x + step.dx, y: this._y + step.dy }
    if (!game.world.isWalkable(next.x, next.y)) return
    const radius = this.def.wanderRadius ?? DEFAULT_WANDER_RADIUS
    if (chebyshev(next, this.spawnPosition) > radius) return
    this._x = next.x
    this._y = next.y
  }
}
