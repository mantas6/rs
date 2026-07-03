import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { cookingRecipes } from '../../content/recipes'
import { Game, type ObjectPlacement } from '../core/game'
import type { WorldObject } from '../world/worldObject'
import { cookBurnChance } from './cooking'
import type { ActionFailReason } from './gathering'
import { xpForLevel } from './skills'

// testMap spawn is (2, 2); row 2 is fully walkable from x=1 to x=14.
const RANGE = { defId: 'cooking_range', x: 6, y: 2 }

function makeGame(objects: ObjectPlacement[] = [], seed = 42): Game {
  return new Game({ seed, map: testMap, objects })
}

function objectAt(game: Game, x: number, y: number): WorldObject {
  const object = game.world.objectAt(x, y)
  if (!object) throw new Error(`no object at (${x}, ${y})`)
  return object
}

function collectFailures(game: Game): ActionFailReason[] {
  const reasons: ActionFailReason[] = []
  game.events.on('actionFailed', ({ reason }) => reasons.push(reason))
  return reasons
}

describe('cookBurnChance', () => {
  const shrimps = cookingRecipes.raw_shrimps

  it('is the max chance at the required level and 0 at the stop level', () => {
    expect(cookBurnChance(shrimps, 1)).toBeCloseTo(0.5)
    expect(cookBurnChance(shrimps, 34)).toBe(0)
    expect(cookBurnChance(shrimps, 99)).toBe(0)
  })

  it('interpolates linearly in between', () => {
    // Halfway from 1 to 34 is 17.5; level 17 is just above half chance.
    expect(cookBurnChance(shrimps, 17)).toBeCloseTo(0.5 * (17 / 33))
    expect(cookBurnChance(cookingRecipes.raw_trout, 49)).toBe(0)
  })
})

describe('cooking: on a fire', () => {
  it('produces a deterministic mix of cooked and burnt at level 1', () => {
    const game = makeGame()
    const fire = game.fires.light(3, 2, 10_000) // adjacent to spawn (2, 2)
    game.player.inventory.add('raw_shrimps', 20)
    const cooked: Array<{ resultItemId: string; burnt: boolean }> = []
    game.events.on('itemCooked', ({ resultItemId, burnt }) => cooked.push({ resultItemId, burnt }))

    expect(game.player.cook('raw_shrimps', fire)).toBe(true)
    for (let i = 0; i < 80; i++) game.tick() // 4 ticks per item * 20

    expect(game.player.inventory.count('raw_shrimps')).toBe(0)
    const good = game.player.inventory.count('shrimps')
    const burnt = game.player.inventory.count('burnt_shrimps')
    expect(good + burnt).toBe(20)
    expect(good).toBeGreaterThan(0) // burn chance 0.5 at level 1: mixed
    expect(burnt).toBeGreaterThan(0)
    expect(cooked).toHaveLength(20)
    expect(game.player.skills.getXp('cooking')).toBe(good * cookingRecipes.raw_shrimps.xp)
    expect(game.player.action).toBeNull() // ends when raw items run out
  })

  it('never burns at or above the burn stop level', () => {
    const game = makeGame()
    const fire = game.fires.light(3, 2, 10_000)
    game.player.skills.addXp('cooking', xpForLevel(34)) // shrimps stop level
    game.player.inventory.add('raw_shrimps', 10)

    game.player.cook('raw_shrimps', fire)
    for (let i = 0; i < 40; i++) game.tick()

    expect(game.player.inventory.count('shrimps')).toBe(10)
    expect(game.player.inventory.count('burnt_shrimps')).toBe(0)
  })

  it('fails with invalid_source on an expired fire', () => {
    const game = makeGame()
    const fire = game.fires.light(3, 2, 3)
    game.player.inventory.add('raw_shrimps')
    for (let i = 0; i < 3; i++) game.tick() // fire expires at tick 3
    expect(fire.expired).toBe(true)
    const failures = collectFailures(game)

    expect(game.player.cook('raw_shrimps', fire)).toBe(false)
    expect(failures).toEqual(['invalid_source'])
  })

  it('stops mid-run when the fire expires under it', () => {
    const game = makeGame()
    // Expires at tick 6: exactly one shrimp cooks (on tick 4) before then.
    const fire = game.fires.light(3, 2, 6)
    game.player.inventory.add('raw_shrimps', 5)
    const failures = collectFailures(game)

    game.player.cook('raw_shrimps', fire)
    for (let i = 0; i < 8; i++) game.tick()

    expect(game.player.inventory.count('raw_shrimps')).toBe(4)
    expect(failures).toEqual(['invalid_source'])
    expect(game.player.action).toBeNull()
  })
})

describe('cooking: on a range', () => {
  it('walks adjacent first, then cooks one item per 4 ticks', () => {
    const game = makeGame([RANGE])
    const range = objectAt(game, RANGE.x, RANGE.y)
    game.player.inventory.add('raw_beef', 3)

    expect(game.player.cook('raw_beef', range)).toBe(true)
    expect(game.player.isMoving).toBe(true)

    game.tick()
    game.tick()
    game.tick()
    expect(game.player.position).toEqual({ x: 5, y: 2 }) // adjacent to the range
    expect(game.player.inventory.count('raw_beef')).toBe(3) // nothing cooked while walking

    // 4 ticks per item: items complete on ticks 7, 11 and 15.
    for (let i = 0; i < 11; i++) game.tick() // now at tick 14
    expect(
      game.player.inventory.count('cooked_beef') + game.player.inventory.count('burnt_beef'),
    ).toBe(2)

    game.tick() // tick 15: last item
    expect(
      game.player.inventory.count('cooked_beef') + game.player.inventory.count('burnt_beef'),
    ).toBe(3)
    expect(game.player.inventory.count('raw_beef')).toBe(0)
    expect(game.player.action).toBeNull()
  })

  it('ranges block movement', () => {
    const game = makeGame([RANGE])
    expect(game.world.isWalkable(RANGE.x, RANGE.y)).toBe(false)
    expect(game.player.walkTo(RANGE.x, RANGE.y)).toBe(false)
  })
})

describe('cooking: validation', () => {
  it('emits level_too_low for trout at cooking 1', () => {
    const game = makeGame()
    const fire = game.fires.light(3, 2, 10_000)
    game.player.inventory.add('raw_trout')
    const failures = collectFailures(game)

    expect(game.player.cook('raw_trout', fire)).toBe(false)
    expect(failures).toEqual(['level_too_low'])
  })

  it('emits missing_ingredient without the raw item', () => {
    const game = makeGame()
    const fire = game.fires.light(3, 2, 10_000)
    const failures = collectFailures(game)

    expect(game.player.cook('raw_shrimps', fire)).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('emits invalid_source for objects that are not cooking sources', () => {
    const game = makeGame([{ defId: 'bank_booth', x: 6, y: 2 }])
    game.player.inventory.add('raw_shrimps')
    const failures = collectFailures(game)

    expect(game.player.cook('raw_shrimps', objectAt(game, 6, 2))).toBe(false)
    expect(failures).toEqual(['invalid_source'])
  })

  it('throws on items without a cooking recipe', () => {
    const game = makeGame()
    const fire = game.fires.light(3, 2, 10_000)
    expect(() => game.player.cook('logs', fire)).toThrow(/Unknown cooking recipe/)
  })
})

describe('cooking: interruption', () => {
  it('walkTo cancels cooking', () => {
    const game = makeGame()
    const fire = game.fires.light(3, 2, 10_000)
    game.player.inventory.add('raw_shrimps', 5)

    game.player.cook('raw_shrimps', fire)
    game.tick()
    expect(game.player.walkTo(2, 3)).toBe(true)
    expect(game.player.action).toBeNull()

    for (let i = 0; i < 8; i++) game.tick()
    expect(game.player.inventory.count('raw_shrimps')).toBe(5)
  })
})

describe('cooking: determinism', () => {
  it('same seed + same commands produce identical results', () => {
    const run = (): { good: number; burnt: number; xp: number } => {
      const game = makeGame([], 1234)
      const fire = game.fires.light(3, 2, 10_000)
      game.player.inventory.add('raw_shrimps', 15)
      game.player.cook('raw_shrimps', fire)
      for (let i = 0; i < 60; i++) game.tick()
      return {
        good: game.player.inventory.count('shrimps'),
        burnt: game.player.inventory.count('burnt_shrimps'),
        xp: game.player.skills.getXp('cooking'),
      }
    }

    const a = run()
    const b = run()
    expect(a).toEqual(b)
    expect(a.good + a.burnt).toBe(15)
  })
})
