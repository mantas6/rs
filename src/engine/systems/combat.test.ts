import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { npcs } from '../../content/npcs'
import { Game, type NpcPlacement } from '../core/game'
import { Rng } from '../core/rng'
import { chebyshev } from '../world/vec2'
import { xpForLevel } from './skills'
import type { AttackStyle } from './combat'
import {
  attackRoll,
  defenceRoll,
  effectiveLevel,
  hitChance,
  maxHit,
  rollDamage,
} from './combat'

// testMap spawn is (2, 2). Chickens/cows are passive; goblins/rats aggro
// within AGGRO_RANGE (3), so passive NPCs are used unless aggression is
// the point of the test.
const CHICKEN = { defId: 'chicken', x: 6, y: 2 }

function makeGame(placements: NpcPlacement[], seed = 42): Game {
  return new Game({ seed, map: testMap, npcs: placements })
}

/** Tick until `done` returns true (throws after `max` ticks). */
function tickUntil(game: Game, done: () => boolean, max = 400): void {
  for (let i = 0; i < max; i++) {
    game.tick()
    if (done()) return
  }
  throw new Error(`condition not met within ${max} ticks`)
}

describe('combat formulas', () => {
  it('effectiveLevel adds the style bonus and a flat 8', () => {
    expect(effectiveLevel(10, 3)).toBe(21) // accurate/aggressive style
    expect(effectiveLevel(10, 0)).toBe(18)
    expect(effectiveLevel(1, 1)).toBe(10) // NPC convention: level + 9
  })

  it('attack and defence rolls multiply by (bonus + 64)', () => {
    expect(attackRoll(21, 0)).toBe(21 * 64)
    expect(attackRoll(21, 36)).toBe(21 * 100)
    expect(defenceRoll(18, 6)).toBe(18 * 70)
  })

  it('maxHit matches hand-computed values', () => {
    // str 10 + aggressive (+3): effective 21, no bonus => floor(0.5 + 21*64/640) = 2
    expect(maxHit(21, 0)).toBe(2)
    // same with +64 strength bonus => floor(0.5 + 21*128/640) = floor(4.7) = 4
    expect(maxHit(21, 64)).toBe(4)
    // str 1, no style: effective 9 => floor(0.5 + 0.9) = 1
    expect(maxHit(9, 0)).toBe(1)
  })

  it('hitChance matches hand-computed values on both branches', () => {
    // attacker ahead: 1 - (500+2) / (2*(1000+1))
    expect(hitChance(1000, 500)).toBeCloseTo(1 - 502 / 2002, 10)
    // defender ahead or equal: atk / (2*(def+1))
    expect(hitChance(500, 1000)).toBeCloseTo(500 / 2002, 10)
    expect(hitChance(640, 640)).toBeCloseTo(640 / 1282, 10)
  })

  it('rollDamage stays within [0, maxHit]', () => {
    const rng = new Rng(7)
    for (let i = 0; i < 200; i++) {
      const damage = rollDamage(rng, 800, 600, 3)
      expect(damage).toBeGreaterThanOrEqual(0)
      expect(damage).toBeLessThanOrEqual(3)
    }
  })
})

describe('player attacks an npc', () => {
  it('walks adjacent, fights, kills, and gets xp matching damage dealt', () => {
    const game = makeGame([CHICKEN])
    const npc = game.npcs[0]
    const playerHits: number[] = []
    let distanceAtFirstHit = -1
    game.events.on('damageDealt', (e) => {
      if (e.source !== 'player') return
      if (playerHits.length === 0) {
        distanceAtFirstHit = chebyshev(game.player.position, npc.position)
      }
      playerHits.push(e.damage)
    })

    expect(game.player.attack(npc)).toBe(true)
    expect(game.player.isMoving).toBe(true)

    tickUntil(game, () => !npc.alive)
    expect(distanceAtFirstHit).toBe(1) // walked into melee range first
    expect(npc.currentHp).toBe(0)

    const totalDamage = playerHits.reduce((a, b) => a + b, 0)
    expect(totalDamage).toBe(npcs.chicken.combat.hitpoints) // overkill is capped
    expect(game.player.skills.getXp('attack')).toBeCloseTo(4 * totalDamage, 6)
    expect(game.player.skills.getXp('hitpoints')).toBeCloseTo(
      1154 + (4 / 3) * totalDamage, // 1154 = xp for the starting hp level 10
      6,
    )
  })

  it('drops always-items plus the weighted roll on death, then respawns', () => {
    const game = makeGame([CHICKEN])
    const npc = game.npcs[0]
    const deaths: Array<{ npcId: string; x: number; y: number }> = []
    const respawns: Array<{ npcId: string; x: number; y: number }> = []
    game.events.on('npcDied', (e) => deaths.push(e))
    game.events.on('npcRespawned', (e) => respawns.push(e))

    game.player.attack(npc)
    tickUntil(game, () => !npc.alive)

    expect(deaths).toHaveLength(1)
    const dropped = game.groundItems.itemsAt(deaths[0].x, deaths[0].y).map((g) => g.itemId)
    expect(dropped).toContain('bones')
    expect(dropped).toContain('raw_chicken')

    // tickUntil stopped on the death tick, so the timer counts from here.
    const respawnAt = npc.respawnAtTick
    expect(respawnAt).toBe(game.tickCount + npcs.chicken.respawnTicks)
    tickUntil(game, () => npc.alive)
    expect(game.tickCount).toBe(respawnAt)
    expect(respawns).toEqual([{ npcId: 'chicken', x: CHICKEN.x, y: CHICKEN.y }])
    expect(npc.position).toEqual({ x: CHICKEN.x, y: CHICKEN.y })
    expect(npc.currentHp).toBe(npcs.chicken.combat.hitpoints)
  })

  it('spam-clicking a target cannot attack faster than the weapon speed', () => {
    // Cow adjacent to the spawn (2, 2): the first swing lands immediately
    // (no walking) and the passive cow, once hit, retaliates and stays put.
    // Unarmed max hit is 1, so across 7 swings the 8-hp cow cannot die and
    // the fight keeps running for the whole spam window.
    const game = makeGame([{ defId: 'cow', x: 3, y: 2 }])
    const cow = game.npcs[0]
    const speed = game.player.equipment.weaponSpeed() // unarmed = 4 ticks

    const attackTicks: number[] = []
    game.events.on('damageDealt', (e) => {
      // damageDealt fires on every attack (incl. misses), so counting the
      // player-sourced events counts ATTACKS regardless of the damage roll.
      if (e.source === 'player') attackTicks.push(game.tickCount)
    })

    const TICKS = 25
    expect(game.player.attack(cow)).toBe(true)
    for (let i = 0; i < TICKS; i++) {
      game.tick()
      // Re-issue the command every single tick, as fast as a UI possibly
      // could — this recreates the AttackAction each time.
      game.player.attack(cow)
    }

    // Attacks land only on the weapon-speed cadence (ticks 1, 5, 9, ...),
    // never once per tick — the exploit (a reset cooldown per click) is gone.
    expect(cow.alive).toBe(true)
    expect(attackTicks).toEqual([1, 5, 9, 13, 17, 21, 25])
    expect(attackTicks.length).toBe(Math.floor((TICKS - 1) / speed) + 1)
    expect(attackTicks.length).toBeLessThan(TICKS) // not one hit per tick
  })

  it('attacking a dead npc fails with target_dead', () => {
    const game = makeGame([CHICKEN])
    const npc = game.npcs[0]
    game.player.attack(npc)
    tickUntil(game, () => !npc.alive)
    const failures: string[] = []
    game.events.on('actionFailed', ({ reason }) => failures.push(reason))

    expect(game.player.attack(npc)).toBe(false)
    expect(failures).toEqual(['target_dead'])
  })
})

describe('attack styles', () => {
  function xpAfterKill(style: AttackStyle): Game['player']['skills'] {
    const game = makeGame([CHICKEN])
    game.player.setAttackStyle(style)
    const npc = game.npcs[0]
    game.player.attack(npc)
    tickUntil(game, () => !npc.alive)
    return game.player.skills
  }

  it('accurate grants attack xp only', () => {
    const skills = xpAfterKill('accurate')
    expect(skills.getXp('attack')).toBeCloseTo(12, 6) // 4 * 3 hp
    expect(skills.getXp('strength')).toBe(0)
    expect(skills.getXp('defence')).toBe(0)
  })

  it('aggressive grants strength xp only', () => {
    const skills = xpAfterKill('aggressive')
    expect(skills.getXp('strength')).toBeCloseTo(12, 6)
    expect(skills.getXp('attack')).toBe(0)
  })

  it('defensive grants defence xp only', () => {
    const skills = xpAfterKill('defensive')
    expect(skills.getXp('defence')).toBeCloseTo(12, 6)
    expect(skills.getXp('attack')).toBe(0)
  })

  it('controlled splits 4/3 per damage across attack, strength and defence', () => {
    const skills = xpAfterKill('controlled')
    expect(skills.getXp('attack')).toBeCloseTo(4, 6) // (4/3) * 3 hp
    expect(skills.getXp('strength')).toBeCloseTo(4, 6)
    expect(skills.getXp('defence')).toBeCloseTo(4, 6)
    expect(skills.getXp('hitpoints')).toBeCloseTo(1154 + 4, 6)
  })
})

describe('npc retaliation and aggression', () => {
  it('an aggressive npc attacks the player and deals damage', () => {
    // Giant rat at (4, 2) is within AGGRO_RANGE 3 of the spawn (2, 2).
    const game = makeGame([{ defId: 'giant_rat', x: 4, y: 2 }])
    const rat = game.npcs[0]
    const npcHits: number[] = []
    game.events.on('damageDealt', (e) => {
      if (e.source === 'npc') npcHits.push(e.damage)
    })

    game.tick()
    expect(rat.target).toBe(game.player)

    tickUntil(game, () => game.player.skills.getCurrentLevel('hitpoints') < 10)
    expect(npcHits.some((d) => d > 0)).toBe(true)
  })

  it('a passive npc retaliates when attacked', () => {
    const game = makeGame([{ defId: 'cow', x: 6, y: 7 }])
    const cow = game.npcs[0]
    expect(cow.def.combat.aggressive).toBe(false)

    game.player.attack(cow)
    tickUntil(game, () => cow.target !== null)
    expect(cow.target).toBe(game.player)
  })

  it('damageDealt carries the npc instance for both attack directions', () => {
    const game = makeGame([{ defId: 'cow', x: 6, y: 7 }])
    const cow = game.npcs[0]
    const sources = new Set<string>()
    game.events.on('damageDealt', (e) => {
      expect(e.npc).toBe(cow)
      sources.add(e.source)
    })

    game.player.attack(cow)
    tickUntil(game, () => !cow.alive)
    expect(sources.has('player')).toBe(true) // player hit the cow
    expect(sources.has('npc')).toBe(true) // the cow retaliated at least once
  })
})

describe('player death', () => {
  it('emits playerDied, restores full hp and teleports to spawn', () => {
    const game = makeGame([{ defId: 'giant_rat', x: 10, y: 10 }], 7)
    const player = game.player
    const deaths: Array<{ x: number; y: number }> = []
    game.events.on('playerDied', (e) => deaths.push(e))

    player.skills.boost('hitpoints', -9) // 10 -> 1: next hit kills
    player.walkTo(9, 10) // walk into aggro range and stand there
    tickUntil(game, () => deaths.length > 0, 800)

    expect(player.position).toEqual({ x: 2, y: 2 }) // back at map spawn
    expect(player.skills.getCurrentLevel('hitpoints')).toBe(10) // full heal
    expect(player.action).toBeNull()
    expect(player.isMoving).toBe(false)
    expect(game.npcs[0].target).toBeNull() // npc released
  })
})

describe('prayers affect combat', () => {
  it('a strength prayer raises the effective strength level and max hit', () => {
    // effectiveLevel(str 40, aggressive +3, prayerMult 1.15) vs no prayer.
    const base = effectiveLevel(40, 3, 1)
    const buffed = effectiveLevel(40, 3, 1.15) // Ultimate Strength +15%
    expect(buffed).toBeGreaterThan(base)
    // floor(40 * 1.15) + 3 + 8 = 46 + 11 = 57 vs 40 + 11 = 51
    expect(base).toBe(51)
    expect(buffed).toBe(57)
    expect(maxHit(buffed, 0)).toBeGreaterThan(maxHit(base, 0))
  })

  it('an attack prayer raises the effective attack level', () => {
    expect(effectiveLevel(60, 3, 1.2)).toBeGreaterThan(effectiveLevel(60, 3, 1))
  })

  it('a defence prayer raises effective defence used by performNpcAttack', () => {
    // performNpcAttack passes player.prayers.defenceMultiplier() as prayerMult
    // for the player's effective defence; assert the multiplier path raises it.
    const game = makeGame([{ defId: 'cow', x: 6, y: 7 }])
    game.player.skills.addXp('prayer', xpForLevel(30))
    game.player.skills.addXp('defence', xpForLevel(40)) // so the % boost matters
    game.player.activatePrayer('steel_skin') // +15% defence
    expect(game.player.prayers.defenceMultiplier()).toBeCloseTo(1.15, 10)
    const cl = game.player.skills.getCurrentLevel('defence')
    const styleDef = 0
    expect(effectiveLevel(cl, styleDef, game.player.prayers.defenceMultiplier())).toBeGreaterThan(
      effectiveLevel(cl, styleDef, 1),
    )
  })
})

describe('combat determinism', () => {
  it('same seed + same commands produce an identical outcome', () => {
    const run = (): string => {
      const game = makeGame(
        [
          { defId: 'giant_rat', x: 5, y: 2 },
          { defId: 'chicken', x: 6, y: 10 },
        ],
        99,
      )
      const log: string[] = []
      game.events.on('damageDealt', (e) => log.push(`${e.source}>${e.targetId}:${e.damage}`))
      game.events.on('playerDied', () => log.push('playerDied'))
      game.events.on('npcDied', (e) => log.push(`npcDied:${e.npcId}`))
      game.player.attack(game.npcs[0])
      for (let i = 0; i < 300; i++) game.tick()
      return JSON.stringify({
        log,
        hp: game.player.skills.getCurrentLevel('hitpoints'),
        attackXp: game.player.skills.getXp('attack'),
        playerPos: game.player.position,
        npcPos: game.npcs.map((n) => n.position),
        ground: game.groundItems.items.map((g) => [g.itemId, g.quantity, g.x, g.y]),
      })
    }

    const a = run()
    expect(a).toBe(run())
    expect(JSON.parse(a).log.length).toBeGreaterThan(0)
  })
})
