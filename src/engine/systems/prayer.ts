import { PRAYERS } from '../../content/prayers'
import type { PrayerDef } from '../../content/types'
import type { EventBus } from '../core/eventBus'
import type { Skills } from './skills'

/**
 * Number of ticks over which a prayer's `drainRate` prayer points are drained
 * while active. A prayer with `drainRate: 1` costs 1 prayer point every 60
 * ticks (36 seconds). Drain from all active prayers is summed and accumulated
 * with integer math so the model stays fully deterministic.
 */
export const PRAYER_DRAIN_PERIOD_TICKS = 60

/** Prayer lookup for engine code (content stays data-only). */
export function getPrayerDef(id: string): PrayerDef {
  const def = PRAYERS[id]
  if (!def) throw new Error(`Unknown prayer id: ${id}`)
  return def
}

// Prayer system events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when a prayer is switched on. */
    prayerActivated: { prayerId: string }
    /** Emitted when a prayer is switched off (manually, on drain-out, death). */
    prayerDeactivated: { prayerId: string }
    /** Emitted whenever prayer points change from drain (payload = new points). */
    prayerDrained: { points: number }
    /** Emitted once when prayer points hit 0 and all prayers switch off. */
    prayerPointsDepleted: Record<string, never>
  }
}

/**
 * Activatable combat prayers owned by the Player.
 *
 * Prayer points are NOT a separate resource: they are the drainable current
 * level of the `prayer` skill (mirroring how hitpoints current level doubles
 * as current HP). Activating prayers drains that current level via
 * `skills.boost('prayer', -1)`; the base level (from buried-bone XP) is the
 * maximum. The existing `Skills.restoreTowardBase()` (Game calls it every 100
 * ticks) slowly regenerates drained prayer points — acceptable for this
 * singleplayer clone.
 *
 * All state here is TRANSIENT: active prayers and the drain accumulator are
 * never serialized. On load (and on death) prayers reset to none active,
 * consistent with the engine dropping the in-progress action. This means the
 * feature needs NO save-format change.
 */
export class Prayers {
  private readonly active = new Set<string>()
  /** Integer accumulator of drain "points x ticks"; see drain(). */
  private drainAccumulator = 0

  constructor(private readonly events: EventBus) {}

  /** True when the prayer with `id` is currently active. */
  isActive(id: string): boolean {
    return this.active.has(id)
  }

  /** Ids of every currently active prayer (insertion order). */
  activeIds(): string[] {
    return [...this.active]
  }

  /**
   * Switch a prayer on. Fails (returns false, nothing changes) when the
   * prayer is unknown, already active, the player's BASE prayer level is
   * below the requirement, or current prayer points are 0. Emits
   * `prayerActivated` on success.
   */
  activate(id: string, skills: Skills): boolean {
    const def = getPrayerDef(id)
    if (this.active.has(id)) return false
    if (skills.getLevel('prayer') < def.levelRequired) return false
    if (skills.getCurrentLevel('prayer') <= 0) return false
    this.active.add(id)
    this.events.emit('prayerActivated', { prayerId: id })
    return true
  }

  /**
   * Switch a prayer off. Returns false when it was not active (no event).
   * Emits `prayerDeactivated` on success.
   */
  deactivate(id: string): boolean {
    if (!this.active.delete(id)) return false
    this.events.emit('prayerDeactivated', { prayerId: id })
    return true
  }

  /**
   * Toggle a prayer: deactivate when active, otherwise activate. Returns the
   * resulting active state (true = now on).
   */
  toggle(id: string, skills: Skills): boolean {
    if (this.active.has(id)) {
      this.deactivate(id)
      return false
    }
    return this.activate(id, skills)
  }

  /** Highest active attack bonus (0 when none), as a fraction. */
  private maxBonus(pick: (def: PrayerDef) => number | undefined): number {
    let best = 0
    for (const id of this.active) {
      const bonus = pick(getPrayerDef(id)) ?? 0
      if (bonus > best) best = bonus
    }
    return best
  }

  /** Effective-attack multiplier (1 + highest active attack bonus). */
  attackMultiplier(): number {
    return 1 + this.maxBonus((def) => def.attackBonus)
  }

  /** Effective-strength multiplier (1 + highest active strength bonus). */
  strengthMultiplier(): number {
    return 1 + this.maxBonus((def) => def.strengthBonus)
  }

  /** Effective-defence multiplier (1 + highest active defence bonus). */
  defenceMultiplier(): number {
    return 1 + this.maxBonus((def) => def.defenceBonus)
  }

  /**
   * Advance prayer drain by one tick. Called once per tick by the Game.
   *
   * The summed `drainRate` of every active prayer is added to an integer
   * accumulator each tick; every time the accumulator reaches
   * PRAYER_DRAIN_PERIOD_TICKS it drains 1 prayer point (`skills.boost` and a
   * `prayerDrained` event) and subtracts the period. When prayer points reach
   * 0 all prayers switch off (a `prayerDeactivated` per prayer) and a single
   * `prayerPointsDepleted` event fires. Fully deterministic (integer math).
   */
  drain(skills: Skills): void {
    if (this.active.size === 0) {
      this.drainAccumulator = 0
      return
    }
    let rate = 0
    for (const id of this.active) rate += getPrayerDef(id).drainRate
    this.drainAccumulator += rate
    while (this.drainAccumulator >= PRAYER_DRAIN_PERIOD_TICKS) {
      this.drainAccumulator -= PRAYER_DRAIN_PERIOD_TICKS
      skills.boost('prayer', -1)
      const points = skills.getCurrentLevel('prayer')
      this.events.emit('prayerDrained', { points })
      if (points <= 0) {
        this.depleteAll()
        return
      }
    }
  }

  /** Deactivate every prayer and emit the depletion event. */
  private depleteAll(): void {
    for (const id of [...this.active]) this.deactivate(id)
    this.drainAccumulator = 0
    this.events.emit('prayerPointsDepleted', {})
  }

  /**
   * Clear all active prayers and reset the accumulator WITHOUT emitting
   * events. Used on death and when the player is restored (prayers are
   * transient and always load reset).
   */
  reset(): void {
    this.active.clear()
    this.drainAccumulator = 0
  }
}
