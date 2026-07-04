import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { fletchingRecipes } from '../../content/recipes'
import { Game } from '../core/game'
import type { ActionFailReason } from './gathering'
import { xpForLevel } from './skills'

function makeGame(seed = 42): Game {
  return new Game({ seed, map: testMap, objects: [] })
}

function collectFailures(game: Game): ActionFailReason[] {
  const reasons: ActionFailReason[] = []
  game.events.on('actionFailed', ({ reason }) => reasons.push(reason))
  return reasons
}

/** Give the player a fletching kit: a knife and some logs. */
function stockFletchingKit(game: Game, logs = 3): void {
  game.player.inventory.add('knife')
  game.player.inventory.add('logs', logs)
}

describe('fletching: carving arrow shafts', () => {
  it('carves one log per few ticks into a batch of shafts, no walking', () => {
    const game = makeGame()
    stockFletchingKit(game, 3)
    const fletched: { productItemId: string; quantity: number }[] = []
    game.events.on('itemFletched', (e) => fletched.push(e))

    expect(game.player.fletch('arrow_shafts')).toBe(true)
    expect(game.player.isMoving).toBe(false) // carved where you stand

    for (let i = 0; i < 20; i++) game.tick()
    expect(game.player.inventory.count('arrow_shafts')).toBe(3 * 15)
    expect(game.player.inventory.count('logs')).toBe(0)
    expect(game.player.inventory.count('knife')).toBe(1) // knife is not consumed
    expect(game.player.skills.getXp('fletching')).toBe(3 * fletchingRecipes.arrow_shafts.xp)
    expect(fletched).toEqual([
      { productItemId: 'arrow_shafts', quantity: 15 },
      { productItemId: 'arrow_shafts', quantity: 15 },
      { productItemId: 'arrow_shafts', quantity: 15 },
    ])
    expect(game.player.action).toBeNull() // ends when the logs run out
  })

  it('repeats over multiple intervals and stops when logs run out', () => {
    const game = makeGame()
    stockFletchingKit(game, 2)

    game.player.fletch('arrow_shafts')
    // One log carved after FLETCH_INTERVAL_TICKS (3) ticks.
    game.tick()
    game.tick()
    expect(game.player.inventory.count('arrow_shafts')).toBe(0)
    game.tick()
    expect(game.player.inventory.count('arrow_shafts')).toBe(15)
    expect(game.player.inventory.count('logs')).toBe(1)

    for (let i = 0; i < 3; i++) game.tick()
    expect(game.player.inventory.count('arrow_shafts')).toBe(30)
    expect(game.player.inventory.count('logs')).toBe(0)
    expect(game.player.action).toBeNull()
  })
})

describe('fletching: unstrung bows', () => {
  it('carves a shortbow once fletching is high enough', () => {
    const game = makeGame()
    game.player.skills.addXp('fletching', xpForLevel(5)) // shortbow requires level 5
    stockFletchingKit(game, 1)

    game.player.fletch('shortbow_u')
    for (let i = 0; i < 6; i++) game.tick()

    expect(game.player.inventory.count('shortbow_u')).toBe(1)
    expect(game.player.inventory.count('logs')).toBe(0)
    expect(game.player.skills.getXp('fletching')).toBe(
      xpForLevel(5) + fletchingRecipes.shortbow_u.xp,
    )
  })

  it('carves an oak shortbow from oak logs at level 20', () => {
    const game = makeGame()
    game.player.skills.addXp('fletching', xpForLevel(20))
    game.player.inventory.add('knife')
    game.player.inventory.add('oak_logs', 1)

    game.player.fletch('oak_shortbow_u')
    for (let i = 0; i < 6; i++) game.tick()

    expect(game.player.inventory.count('oak_shortbow_u')).toBe(1)
    expect(game.player.inventory.count('oak_logs')).toBe(0)
  })
})

describe('fletching: validation', () => {
  it('emits missing_tool without a knife', () => {
    const game = makeGame()
    game.player.inventory.add('logs')
    const failures = collectFailures(game)

    expect(game.player.fletch('arrow_shafts')).toBe(false)
    expect(failures).toEqual(['missing_tool'])
  })

  it('emits level_too_low for a longbow at fletching 1', () => {
    const game = makeGame()
    stockFletchingKit(game, 1)
    const failures = collectFailures(game)

    expect(game.player.fletch('longbow_u')).toBe(false)
    expect(failures).toEqual(['level_too_low'])
  })

  it('emits missing_ingredient without logs', () => {
    const game = makeGame()
    game.player.inventory.add('knife')
    const failures = collectFailures(game)

    expect(game.player.fletch('arrow_shafts')).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('throws on products without a fletching recipe', () => {
    const game = makeGame()
    expect(() => game.player.fletch('logs')).toThrow(/Unknown fletching recipe/)
  })
})

describe('fletching: interruption', () => {
  it('walkTo cancels carving without consuming logs', () => {
    const game = makeGame()
    stockFletchingKit(game, 5)

    game.player.fletch('arrow_shafts')
    game.tick()
    expect(game.player.walkTo(2, 3)).toBe(true)
    expect(game.player.action).toBeNull()

    for (let i = 0; i < 12; i++) game.tick()
    expect(game.player.inventory.count('logs')).toBe(5)
    expect(game.player.inventory.count('arrow_shafts')).toBe(0)
  })
})

describe('fletching: determinism', () => {
  it('same seed + same commands produce identical results', () => {
    const run = (): { shafts: number; xp: number } => {
      const game = makeGame(1234)
      stockFletchingKit(game, 3)
      game.player.fletch('arrow_shafts')
      for (let i = 0; i < 20; i++) game.tick()
      return {
        shafts: game.player.inventory.count('arrow_shafts'),
        xp: game.player.skills.getXp('fletching'),
      }
    }

    const a = run()
    const b = run()
    expect(a).toEqual(b)
    expect(a.shafts).toBe(45)
  })
})
