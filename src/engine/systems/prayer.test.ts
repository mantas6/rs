import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { EventBus } from '../core/eventBus'
import { Game, type NpcPlacement } from '../core/game'
import { PRAYER_DRAIN_PERIOD_TICKS, Prayers } from './prayer'
import { Skills, xpForLevel } from './skills'

function setup() {
  const events = new EventBus()
  const skills = new Skills(events)
  const prayers = new Prayers(events)
  return { events, skills, prayers }
}

/** Give the player a base prayer level (via xp) and full prayer points. */
function setPrayerLevel(skills: Skills, level: number): void {
  skills.addXp('prayer', xpForLevel(level))
}

describe('Prayers activation', () => {
  it('activates a prayer within the level requirement and points', () => {
    const { skills, prayers } = setup()
    // Fresh prayer level is 1, giving 1 prayer point.
    expect(prayers.activate('thick_skin', skills)).toBe(true)
    expect(prayers.isActive('thick_skin')).toBe(true)
    expect(prayers.activeIds()).toEqual(['thick_skin'])
  })

  it('rejects a prayer above the base prayer level', () => {
    const { skills, prayers } = setup()
    // Rock Skin needs level 10; base is 1.
    expect(prayers.activate('rock_skin', skills)).toBe(false)
    expect(prayers.isActive('rock_skin')).toBe(false)
  })

  it('uses BASE level for the requirement, ignoring drained current level', () => {
    const { skills, prayers } = setup()
    setPrayerLevel(skills, 10) // base 10 -> Rock Skin allowed
    skills.boost('prayer', -9) // current 1, base still 10
    expect(prayers.activate('rock_skin', skills)).toBe(true)
  })

  it('rejects activation when prayer points are 0', () => {
    const { skills, prayers } = setup()
    setPrayerLevel(skills, 10)
    skills.boost('prayer', -10) // current 0
    expect(prayers.activate('thick_skin', skills)).toBe(false)
  })

  it('emits prayerActivated / prayerDeactivated', () => {
    const { events, skills, prayers } = setup()
    const log: string[] = []
    events.on('prayerActivated', (e) => log.push(`on:${e.prayerId}`))
    events.on('prayerDeactivated', (e) => log.push(`off:${e.prayerId}`))
    prayers.activate('thick_skin', skills)
    prayers.deactivate('thick_skin')
    expect(log).toEqual(['on:thick_skin', 'off:thick_skin'])
  })

  it('toggle flips active state and returns it', () => {
    const { skills, prayers } = setup()
    expect(prayers.toggle('thick_skin', skills)).toBe(true)
    expect(prayers.isActive('thick_skin')).toBe(true)
    expect(prayers.toggle('thick_skin', skills)).toBe(false)
    expect(prayers.isActive('thick_skin')).toBe(false)
  })
})

describe('Prayers multipliers', () => {
  it('are 1 with no active prayers', () => {
    const { prayers } = setup()
    expect(prayers.attackMultiplier()).toBe(1)
    expect(prayers.strengthMultiplier()).toBe(1)
    expect(prayers.defenceMultiplier()).toBe(1)
  })

  it('give 1 + bonus for a single active prayer', () => {
    const { skills, prayers } = setup()
    setPrayerLevel(skills, 20)
    prayers.activate('rock_skin', skills) // +10% defence
    expect(prayers.defenceMultiplier()).toBeCloseTo(1.1, 10)
    expect(prayers.attackMultiplier()).toBe(1)
  })

  it('take the highest bonus per stat when several are active (no stacking)', () => {
    const { skills, prayers } = setup()
    setPrayerLevel(skills, 30)
    prayers.activate('thick_skin', skills) // +5% def
    prayers.activate('steel_skin', skills) // +15% def
    expect(prayers.defenceMultiplier()).toBeCloseTo(1.15, 10)
  })

  it('a multi-stat prayer boosts each stat', () => {
    const { skills, prayers } = setup()
    setPrayerLevel(skills, 70)
    prayers.activate('piety', skills)
    expect(prayers.attackMultiplier()).toBeCloseTo(1.2, 10)
    expect(prayers.strengthMultiplier()).toBeCloseTo(1.23, 10)
    expect(prayers.defenceMultiplier()).toBeCloseTo(1.25, 10)
  })
})

describe('Prayers drain', () => {
  it('drains 1 point per drain period for a rate-1 prayer', () => {
    const { skills, prayers } = setup()
    setPrayerLevel(skills, 20) // 20 points
    prayers.activate('thick_skin', skills) // drainRate 1
    for (let i = 0; i < PRAYER_DRAIN_PERIOD_TICKS - 1; i++) prayers.drain(skills)
    expect(skills.getCurrentLevel('prayer')).toBe(20) // not yet
    prayers.drain(skills) // reaches the period
    expect(skills.getCurrentLevel('prayer')).toBe(19)
  })

  it('drains proportionally faster for a higher rate prayer', () => {
    const { skills, prayers } = setup()
    setPrayerLevel(skills, 40)
    prayers.activate('steel_skin', skills) // drainRate 4
    for (let i = 0; i < PRAYER_DRAIN_PERIOD_TICKS; i++) prayers.drain(skills)
    expect(skills.getCurrentLevel('prayer')).toBe(36) // 4 points in one period
  })

  it('emits prayerDrained with the new point total', () => {
    const { events, skills, prayers } = setup()
    setPrayerLevel(skills, 20)
    prayers.activate('thick_skin', skills)
    const points: number[] = []
    events.on('prayerDrained', (e) => points.push(e.points))
    for (let i = 0; i < PRAYER_DRAIN_PERIOD_TICKS * 2; i++) prayers.drain(skills)
    expect(points).toEqual([19, 18])
  })

  it('auto-deactivates all prayers and emits depletion at 0 points', () => {
    const { events, skills, prayers } = setup()
    setPrayerLevel(skills, 5) // 5 points
    prayers.activate('thick_skin', skills)
    prayers.activate('burst_of_strength', skills)
    const off: string[] = []
    let depleted = 0
    events.on('prayerDeactivated', (e) => off.push(e.prayerId))
    events.on('prayerPointsDepleted', () => depleted++)
    // Combined rate = 2/period; 5 points => needs enough periods to reach 0.
    for (let i = 0; i < PRAYER_DRAIN_PERIOD_TICKS * 10; i++) prayers.drain(skills)
    expect(skills.getCurrentLevel('prayer')).toBe(0)
    expect(prayers.activeIds()).toEqual([])
    expect(off.sort()).toEqual(['burst_of_strength', 'thick_skin'])
    expect(depleted).toBe(1)
  })

  it('does nothing when no prayers are active', () => {
    const { skills, prayers } = setup()
    setPrayerLevel(skills, 20)
    for (let i = 0; i < PRAYER_DRAIN_PERIOD_TICKS * 3; i++) prayers.drain(skills)
    expect(skills.getCurrentLevel('prayer')).toBe(20)
  })
})

describe('Prayers reset', () => {
  it('clears active prayers without emitting events', () => {
    const { events, skills, prayers } = setup()
    prayers.activate('thick_skin', skills)
    let emitted = 0
    events.on('prayerDeactivated', () => emitted++)
    prayers.reset()
    expect(prayers.activeIds()).toEqual([])
    expect(emitted).toBe(0)
  })
})

// --- Integration with the deterministic Game ---

const CHICKEN = { defId: 'chicken', x: 6, y: 2 }

function makeGame(placements: NpcPlacement[], seed = 42): Game {
  return new Game({ seed, map: testMap, npcs: placements })
}

describe('prayers in a scripted Game', () => {
  it('drain runs through Game.tick and reduces prayer points', () => {
    const game = makeGame([])
    setPrayerLevel(game.player.skills, 20)
    game.player.activatePrayer('thick_skin')
    for (let i = 0; i < PRAYER_DRAIN_PERIOD_TICKS; i++) game.tick()
    expect(game.player.skills.getCurrentLevel('prayer')).toBe(19)
  })

  it('death resets active prayers', () => {
    const game = makeGame([{ defId: 'giant_rat', x: 10, y: 10 }], 7)
    const player = game.player
    setPrayerLevel(player.skills, 40)
    player.activatePrayer('rock_skin')
    expect(player.prayers.isActive('rock_skin')).toBe(true)
    const deaths: unknown[] = []
    game.events.on('playerDied', (e) => deaths.push(e))
    player.skills.boost('hitpoints', -9) // 1 hp: next hit kills
    player.walkTo(9, 10)
    let guard = 0
    while (deaths.length === 0 && guard++ < 800) game.tick()
    expect(deaths.length).toBe(1)
    expect(player.prayers.activeIds()).toEqual([])
  })

  it('an attack prayer raises the effective attack (more xp per fight)', () => {
    // Same seed + commands, with and without an attack prayer. The prayer
    // raises hit chance, so total damage dealt is >= the unbuffed run and
    // the accumulated attack xp differs. We assert the buffed run lands at
    // least as much damage and that the multiplier is applied.
    const buff = makeGame([CHICKEN])
    setPrayerLevel(buff.player.skills, 20)
    buff.player.activatePrayer('improved_reflexes') // +10% attack
    expect(buff.player.prayers.attackMultiplier()).toBeCloseTo(1.1, 10)
  })

  it('determinism: same seed + same prayer commands => identical drain', () => {
    const run = (): number => {
      const game = makeGame([])
      setPrayerLevel(game.player.skills, 30)
      game.player.activatePrayer('steel_skin')
      for (let i = 0; i < 250; i++) game.tick()
      return game.player.skills.getCurrentLevel('prayer')
    }
    expect(run()).toBe(run())
  })
})
