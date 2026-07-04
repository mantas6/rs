import type { EventBus } from '../core/eventBus'

/**
 * Single source of truth for skill names (full OSRS set of 23).
 */
export const SKILL_NAMES = [
  'attack',
  'strength',
  'defence',
  'hitpoints',
  'ranged',
  'magic',
  'prayer',
  'woodcutting',
  'mining',
  'fishing',
  'cooking',
  'firemaking',
  'smithing',
  'crafting',
  'fletching',
  'runecraft',
  'herblore',
  'agility',
  'thieving',
  'slayer',
  'farming',
  'construction',
  'hunter',
] as const

export type SkillName = (typeof SKILL_NAMES)[number]

/** Maximum base level. */
export const MAX_LEVEL = 99

/** XP is capped at 200 million per skill, like OSRS. */
export const MAX_XP = 200_000_000

// Skill system events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted every time xp is added to a skill. */
    xpGained: { skill: SkillName; amount: number; totalXp: number }
    /**
     * Emitted once per base level gained. A single addXp call that jumps
     * several levels emits one event for each new level, in order.
     */
    levelUp: { skill: SkillName; level: number }
  }
}

/**
 * OSRS XP table. XP_TABLE[L] = cumulative xp required for level L, using the
 * real formula: floor( sum_{n=1}^{L-1} floor(n + 300 * 2^(n/7)) / 4 ).
 * Index 0 is unused; valid indices are 1..99.
 */
const XP_TABLE: number[] = (() => {
  const table = [0, 0]
  let points = 0
  for (let level = 2; level <= MAX_LEVEL; level++) {
    const n = level - 1
    points += Math.floor(n + 300 * Math.pow(2, n / 7))
    table.push(Math.floor(points / 4))
  }
  return table
})()

/** Cumulative xp required to reach `level` (1..99). */
export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new Error(`xpForLevel: level must be an integer in [1, ${MAX_LEVEL}], got ${level}`)
  }
  return XP_TABLE[level]
}

/** Base level for a given amount of xp (clamped to 1..99). */
export function levelForXp(xp: number): number {
  if (xp < 0) throw new Error(`levelForXp: xp must be >= 0, got ${xp}`)
  // Binary search for the highest level whose requirement is <= xp.
  let lo = 1
  let hi = MAX_LEVEL
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (XP_TABLE[mid] <= xp) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** JSON-safe snapshot of skill state (see Skills.serialize). */
export interface SkillsSave {
  /** Xp per skill. */
  xp: Record<SkillName, number>
  /** Non-zero boost/drain deltas only (current level = base + delta). */
  boosts: Partial<Record<SkillName, number>>
}

/**
 * Per-player skill state: xp per skill plus temporary boosts/drains.
 *
 * Base level is derived from xp. Current level = base level + boost delta;
 * boosts decay toward base one point per call to `restoreTowardBase()`
 * (the Game calls it every 100 ticks = 1 minute, like OSRS).
 *
 * For hitpoints the current level doubles as current HP: damage is a drain
 * (negative boost) and it regenerates via the same restore mechanism.
 */
export class Skills {
  private readonly xp = new Map<SkillName, number>()
  /** Offset of current level from base level; 0 when unboosted. */
  private readonly boostDelta = new Map<SkillName, number>()

  constructor(private readonly events: EventBus) {
    for (const skill of SKILL_NAMES) {
      this.xp.set(skill, skill === 'hitpoints' ? xpForLevel(10) : 0)
    }
  }

  getXp(skill: SkillName): number {
    return this.xp.get(skill) as number
  }

  /** Base level derived from xp. */
  getLevel(skill: SkillName): number {
    return levelForXp(this.getXp(skill))
  }

  /** Current (boostable/drainable) level. Never below 0. */
  getCurrentLevel(skill: SkillName): number {
    return this.getLevel(skill) + (this.boostDelta.get(skill) ?? 0)
  }

  /**
   * Add xp to a skill. Emits `xpGained` with the amount actually added
   * (after the 200m cap), and one `levelUp` event per base level gained.
   */
  addXp(skill: SkillName, amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`addXp: amount must be a non-negative number, got ${amount}`)
    }
    const before = this.getXp(skill)
    const after = Math.min(before + amount, MAX_XP)
    const added = after - before
    if (added <= 0) return
    this.xp.set(skill, after)
    this.events.emit('xpGained', { skill, amount: added, totalXp: after })
    const oldLevel = levelForXp(before)
    const newLevel = levelForXp(after)
    for (let level = oldLevel + 1; level <= newLevel; level++) {
      this.events.emit('levelUp', { skill, level })
    }
  }

  /**
   * Boost (positive delta) or drain (negative delta) a skill's current
   * level. The current level is clamped so it never goes below 0.
   */
  boost(skill: SkillName, delta: number): void {
    if (!Number.isInteger(delta)) {
      throw new Error(`boost: delta must be an integer, got ${delta}`)
    }
    const base = this.getLevel(skill)
    const current = base + (this.boostDelta.get(skill) ?? 0)
    const next = Math.max(0, current + delta)
    this.boostDelta.set(skill, next - base)
  }

  /**
   * Move every boosted/drained skill's current level 1 point toward its
   * base level. The Game calls this every 100 ticks (1 minute), matching
   * OSRS natural stat restore.
   */
  restoreTowardBase(): void {
    for (const [skill, delta] of this.boostDelta) {
      if (delta === 0) continue
      this.boostDelta.set(skill, delta > 0 ? delta - 1 : delta + 1)
    }
  }

  /** JSON-safe snapshot of xp and boost deltas, for save/load. */
  serialize(): SkillsSave {
    const xp = {} as Record<SkillName, number>
    const boosts: Partial<Record<SkillName, number>> = {}
    for (const skill of SKILL_NAMES) {
      xp[skill] = this.getXp(skill)
      const delta = this.boostDelta.get(skill) ?? 0
      if (delta !== 0) boosts[skill] = delta
    }
    return { xp, boosts }
  }

  /**
   * Restore a snapshot from `serialize()`. Emits no events: restore runs
   * during game construction, before any listeners subscribe.
   */
  restore(save: SkillsSave): void {
    for (const skill of SKILL_NAMES) {
      const xp = save.xp[skill] ?? (skill === 'hitpoints' ? xpForLevel(10) : 0)
      if (!Number.isFinite(xp) || xp < 0 || xp > MAX_XP) {
        throw new Error(`Skills.restore: invalid xp for ${skill}: ${xp}`)
      }
      this.xp.set(skill, xp)
    }
    this.boostDelta.clear()
    for (const skill of SKILL_NAMES) {
      const delta = save.boosts[skill]
      if (delta) this.boostDelta.set(skill, delta)
    }
  }

  /** OSRS combat level, floored, from base levels. */
  combatLevel(): number {
    const base =
      0.25 *
      (this.getLevel('defence') +
        this.getLevel('hitpoints') +
        Math.floor(this.getLevel('prayer') / 2))
    const melee = 0.325 * (this.getLevel('attack') + this.getLevel('strength'))
    const range = 0.325 * Math.floor((3 * this.getLevel('ranged')) / 2)
    const mage = 0.325 * Math.floor((3 * this.getLevel('magic')) / 2)
    return Math.floor(base + Math.max(melee, range, mage))
  }
}
