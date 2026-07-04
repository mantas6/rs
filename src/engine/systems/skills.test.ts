import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { EventBus } from '../core/eventBus'
import { Game } from '../core/game'
import { MAX_XP, SKILL_NAMES, Skills, levelForXp, xpForLevel } from './skills'

const makeSkills = () => new Skills(new EventBus())

describe('xp table', () => {
  it('matches known OSRS values', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(83)
    expect(xpForLevel(10)).toBe(1154)
    expect(xpForLevel(50)).toBe(101333)
    expect(xpForLevel(92)).toBe(6517253)
    expect(xpForLevel(99)).toBe(13034431)
  })

  it('rejects out-of-range levels', () => {
    expect(() => xpForLevel(0)).toThrow()
    expect(() => xpForLevel(100)).toThrow()
    expect(() => xpForLevel(1.5)).toThrow()
  })
})

describe('levelForXp', () => {
  it('handles level boundaries', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(82)).toBe(1)
    expect(levelForXp(83)).toBe(2)
    expect(levelForXp(1153)).toBe(9)
    expect(levelForXp(1154)).toBe(10)
    expect(levelForXp(13034430)).toBe(98)
    expect(levelForXp(13034431)).toBe(99)
  })

  it('caps at 99 for huge xp', () => {
    expect(levelForXp(MAX_XP)).toBe(99)
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(99)
  })

  it('is consistent with xpForLevel across all levels', () => {
    for (let level = 1; level <= 99; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level)
      if (level > 1) expect(levelForXp(xpForLevel(level) - 1)).toBe(level - 1)
    }
  })
})

describe('Skills', () => {
  it('fresh skills: hitpoints level 10, everything else level 1', () => {
    const skills = makeSkills()
    for (const skill of SKILL_NAMES) {
      if (skill === 'hitpoints') {
        expect(skills.getLevel(skill)).toBe(10)
        expect(skills.getXp(skill)).toBe(1154)
      } else {
        expect(skills.getLevel(skill)).toBe(1)
        expect(skills.getXp(skill)).toBe(0)
      }
    }
  })

  it('accumulates xp and raises the base level', () => {
    const skills = makeSkills()
    skills.addXp('woodcutting', 50)
    skills.addXp('woodcutting', 33)
    expect(skills.getXp('woodcutting')).toBe(83)
    expect(skills.getLevel('woodcutting')).toBe(2)
  })

  it('emits xpGained with amount and totalXp', () => {
    const events = new EventBus()
    const skills = new Skills(events)
    const gained: Array<{ skill: string; amount: number; totalXp: number }> = []
    events.on('xpGained', (e) => gained.push(e))
    skills.addXp('mining', 40)
    skills.addXp('mining', 60)
    expect(gained).toEqual([
      { skill: 'mining', amount: 40, totalXp: 40 },
      { skill: 'mining', amount: 60, totalXp: 100 },
    ])
  })

  it('emits one levelUp per level gained, including multi-level jumps', () => {
    const events = new EventBus()
    const skills = new Skills(events)
    const ups: Array<{ skill: string; level: number }> = []
    events.on('levelUp', (e) => ups.push(e))
    skills.addXp('fishing', 82) // still level 1
    expect(ups).toEqual([])
    skills.addXp('fishing', 1) // exactly 83 => level 2
    expect(ups).toEqual([{ skill: 'fishing', level: 2 }])
    ups.length = 0
    skills.addXp('fishing', xpForLevel(5) - 83) // jump 2 -> 5
    expect(ups).toEqual([
      { skill: 'fishing', level: 3 },
      { skill: 'fishing', level: 4 },
      { skill: 'fishing', level: 5 },
    ])
  })

  it('emits levelUp with the exact skill and new level on a single-level gain', () => {
    const events = new EventBus()
    const skills = new Skills(events)
    const ups: Array<{ skill: string; level: number }> = []
    events.on('levelUp', (e) => ups.push(e))
    // Climb cooking to exactly level 11, then top up to exactly level 12.
    skills.addXp('cooking', xpForLevel(11))
    ups.length = 0 // ignore the 2..11 climb; assert only the single step
    skills.addXp('cooking', xpForLevel(12) - xpForLevel(11))
    expect(ups).toEqual([{ skill: 'cooking', level: 12 }])
    expect(skills.getLevel('cooking')).toBe(12)
  })

  it('does not emit levelUp when xp is gained without crossing a level', () => {
    const events = new EventBus()
    const skills = new Skills(events)
    const ups: Array<{ skill: string; level: number }> = []
    events.on('levelUp', (e) => ups.push(e))
    // 82 xp keeps cooking at level 1 (level 2 needs 83) — xp gained, no level.
    skills.addXp('cooking', 82)
    expect(ups).toEqual([])
    expect(skills.getLevel('cooking')).toBe(1)
    // A second sub-level gain that still stays at level 1 also emits nothing.
    skills.addXp('woodcutting', 50)
    expect(ups).toEqual([])
  })

  it('caps xp at 200m and reports only the xp actually added', () => {
    const events = new EventBus()
    const skills = new Skills(events)
    const gained: number[] = []
    events.on('xpGained', (e) => gained.push(e.amount))
    skills.addXp('cooking', MAX_XP - 10)
    skills.addXp('cooking', 100)
    expect(skills.getXp('cooking')).toBe(MAX_XP)
    expect(gained).toEqual([MAX_XP - 10, 10])
    // Already capped: no further xpGained events.
    skills.addXp('cooking', 100)
    expect(gained).toEqual([MAX_XP - 10, 10])
  })

  it('rejects negative xp', () => {
    const skills = makeSkills()
    expect(() => skills.addXp('attack', -1)).toThrow()
  })
})

describe('boosts and restore', () => {
  it('boost raises the current level without touching base level or xp', () => {
    const skills = makeSkills()
    skills.boost('attack', 4)
    expect(skills.getCurrentLevel('attack')).toBe(5)
    expect(skills.getLevel('attack')).toBe(1)
    expect(skills.getXp('attack')).toBe(0)
  })

  it('drain lowers the current level, clamped at 0', () => {
    const skills = makeSkills()
    skills.boost('hitpoints', -3)
    expect(skills.getCurrentLevel('hitpoints')).toBe(7)
    skills.boost('hitpoints', -100)
    expect(skills.getCurrentLevel('hitpoints')).toBe(0)
  })

  it('restoreTowardBase moves boosts and drains 1 point toward base', () => {
    const skills = makeSkills()
    skills.boost('attack', 4)
    skills.boost('hitpoints', -3)
    skills.restoreTowardBase()
    expect(skills.getCurrentLevel('attack')).toBe(4)
    expect(skills.getCurrentLevel('hitpoints')).toBe(8)
    for (let i = 0; i < 10; i++) skills.restoreTowardBase()
    expect(skills.getCurrentLevel('attack')).toBe(1)
    expect(skills.getCurrentLevel('hitpoints')).toBe(10)
  })

  it('Game.tick restores stats every 100 ticks', () => {
    const game = new Game({ seed: 1, map: testMap })
    game.player.skills.boost('strength', 4)
    for (let i = 0; i < 99; i++) game.tick()
    expect(game.player.skills.getCurrentLevel('strength')).toBe(5)
    game.tick() // tick 100
    expect(game.player.skills.getCurrentLevel('strength')).toBe(4)
    for (let i = 0; i < 100; i++) game.tick() // tick 200
    expect(game.player.skills.getCurrentLevel('strength')).toBe(3)
  })

  it('drained hitpoints recover upward via Game.tick', () => {
    const game = new Game({ seed: 1, map: testMap })
    game.player.skills.boost('hitpoints', -2)
    for (let i = 0; i < 100; i++) game.tick()
    expect(game.player.skills.getCurrentLevel('hitpoints')).toBe(9)
    for (let i = 0; i < 100; i++) game.tick()
    expect(game.player.skills.getCurrentLevel('hitpoints')).toBe(10)
  })
})

describe('combat level', () => {
  it('is 3 for a fresh player', () => {
    const skills = makeSkills()
    expect(skills.combatLevel()).toBe(3)
  })

  it('matches the formula for 40/40/40/40 melee stats with prayer 1', () => {
    const skills = makeSkills()
    for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const) {
      skills.addXp(skill, xpForLevel(40) - skills.getXp(skill))
    }
    // base = 0.25 * (40 + 40 + floor(1/2)) = 20
    // melee = 0.325 * (40 + 40) = 26  => floor(20 + 26) = 46
    expect(skills.combatLevel()).toBe(46)
  })

  it('uses the best of melee, ranged, and magic', () => {
    const skills = makeSkills()
    skills.addXp('ranged', xpForLevel(60))
    // base = 0.25 * (1 + 10 + 0) = 2.75
    // range = 0.325 * floor(3 * 60 / 2) = 0.325 * 90 = 29.25
    // melee = 0.325 * 2 = 0.65 => floor(2.75 + 29.25) = 32
    expect(skills.combatLevel()).toBe(32)
  })

  it('is maxed at 126 with all 99 combat stats', () => {
    const skills = makeSkills()
    const combatSkills = [
      'attack',
      'strength',
      'defence',
      'hitpoints',
      'ranged',
      'magic',
      'prayer',
    ] as const
    for (const skill of combatSkills) {
      skills.addXp(skill, xpForLevel(99) - skills.getXp(skill))
    }
    expect(skills.combatLevel()).toBe(126)
  })
})
