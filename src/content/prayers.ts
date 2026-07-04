// Activatable combat prayer definitions (Prayer skill). Data-only: plain
// objects, no logic, no side effects.
//
// Each prayer grants a fractional boost to one or more combat stats while
// active and drains prayer points over time. `drainRate` is expressed in
// prayer points drained per PRAYER_DRAIN_PERIOD_TICKS (see
// engine/systems/prayer.ts); higher-tier prayers drain faster. When multiple
// active prayers boost the same stat, only the highest bonus applies.
import type { PrayerDef } from './types'

/**
 * Activatable prayers, keyed by id. A classic OSRS-style subset covering the
 * three single-stat boost lines (defence / strength / attack) at +5% / +10%
 * / +15%, plus two high-level multi-stat prayers (Chivalry, Piety).
 */
export const PRAYERS: Record<string, PrayerDef> = {
  thick_skin: {
    id: 'thick_skin',
    name: 'Thick Skin',
    examine: 'Increases your defence by 5%.',
    levelRequired: 1,
    drainRate: 1,
    defenceBonus: 0.05,
  },
  burst_of_strength: {
    id: 'burst_of_strength',
    name: 'Burst of Strength',
    examine: 'Increases your strength by 5%.',
    levelRequired: 4,
    drainRate: 1,
    strengthBonus: 0.05,
  },
  clarity_of_thought: {
    id: 'clarity_of_thought',
    name: 'Clarity of Thought',
    examine: 'Increases your attack by 5%.',
    levelRequired: 7,
    drainRate: 1,
    attackBonus: 0.05,
  },
  rock_skin: {
    id: 'rock_skin',
    name: 'Rock Skin',
    examine: 'Increases your defence by 10%.',
    levelRequired: 10,
    drainRate: 2,
    defenceBonus: 0.1,
  },
  superhuman_strength: {
    id: 'superhuman_strength',
    name: 'Superhuman Strength',
    examine: 'Increases your strength by 10%.',
    levelRequired: 13,
    drainRate: 2,
    strengthBonus: 0.1,
  },
  improved_reflexes: {
    id: 'improved_reflexes',
    name: 'Improved Reflexes',
    examine: 'Increases your attack by 10%.',
    levelRequired: 16,
    drainRate: 2,
    attackBonus: 0.1,
  },
  steel_skin: {
    id: 'steel_skin',
    name: 'Steel Skin',
    examine: 'Increases your defence by 15%.',
    levelRequired: 28,
    drainRate: 4,
    defenceBonus: 0.15,
  },
  ultimate_strength: {
    id: 'ultimate_strength',
    name: 'Ultimate Strength',
    examine: 'Increases your strength by 15%.',
    levelRequired: 31,
    drainRate: 4,
    strengthBonus: 0.15,
  },
  incredible_reflexes: {
    id: 'incredible_reflexes',
    name: 'Incredible Reflexes',
    examine: 'Increases your attack by 15%.',
    levelRequired: 34,
    drainRate: 4,
    attackBonus: 0.15,
  },
  chivalry: {
    id: 'chivalry',
    name: 'Chivalry',
    examine: 'Increases your attack by 15%, strength by 18% and defence by 20%.',
    levelRequired: 60,
    drainRate: 12,
    attackBonus: 0.15,
    strengthBonus: 0.18,
    defenceBonus: 0.2,
  },
  piety: {
    id: 'piety',
    name: 'Piety',
    examine: 'Increases your attack by 20%, strength by 23% and defence by 25%.',
    levelRequired: 70,
    drainRate: 12,
    attackBonus: 0.2,
    strengthBonus: 0.23,
    defenceBonus: 0.25,
  },
}

/** All prayer definitions in display (level) order. */
export const PRAYER_LIST: readonly PrayerDef[] = Object.values(PRAYERS)
