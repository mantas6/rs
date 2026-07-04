import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { smeltingRecipes } from '../../content/recipes'
import { Game, type ObjectPlacement } from '../core/game'
import type { WorldObject } from '../world/worldObject'
import type { ActionFailReason } from './gathering'
import { xpForLevel } from './skills'
import { isValidSmeltingSource } from './smithing'

// testMap spawn is (2, 2); row 2 is fully walkable from x=1 to x=14.
const FURNACE = { defId: 'furnace', x: 6, y: 2 }

function makeGame(objects: ObjectPlacement[] = [FURNACE], seed = 42): Game {
  return new Game({ seed, map: testMap, objects })
}

function furnaceAt(game: Game, x: number, y: number): WorldObject {
  const object = game.world.objectAt(x, y)
  if (!object) throw new Error(`no object at (${x}, ${y})`)
  return object
}

function collectFailures(game: Game): ActionFailReason[] {
  const reasons: ActionFailReason[] = []
  game.events.on('actionFailed', ({ reason }) => reasons.push(reason))
  return reasons
}

describe('smelting: bronze bars', () => {
  it('walks adjacent first, then smelts one bar per 4 ticks', () => {
    const game = makeGame()
    const furnace = furnaceAt(game, FURNACE.x, FURNACE.y)
    game.player.inventory.add('copper_ore', 3)
    game.player.inventory.add('tin_ore', 3)
    const smelted: boolean[] = []
    game.events.on('oreSmelted', ({ success }) => smelted.push(success))

    expect(game.player.smelt('bronze_bar', furnace)).toBe(true)
    expect(game.player.isMoving).toBe(true)

    game.tick()
    game.tick()
    game.tick()
    expect(game.player.position).toEqual({ x: 5, y: 2 }) // adjacent to the furnace
    expect(game.player.inventory.count('bronze_bar')).toBe(0) // nothing smelts while walking

    // 4 ticks per bar: bars complete on ticks 7, 11 and 15.
    for (let i = 0; i < 11; i++) game.tick() // now at tick 14
    expect(game.player.inventory.count('bronze_bar')).toBe(2)

    game.tick() // tick 15: last bar
    expect(game.player.inventory.count('bronze_bar')).toBe(3)
    expect(game.player.inventory.count('copper_ore')).toBe(0)
    expect(game.player.inventory.count('tin_ore')).toBe(0)
    expect(game.player.skills.getXp('smithing')).toBe(3 * smeltingRecipes.bronze_bar.xp)
    expect(smelted).toEqual([true, true, true]) // bronze always succeeds
    expect(game.player.action).toBeNull() // ends when the ore runs out
  })

  it('stops when either ore input runs out', () => {
    const game = makeGame()
    const furnace = furnaceAt(game, FURNACE.x, FURNACE.y)
    game.player.inventory.add('copper_ore', 5)
    game.player.inventory.add('tin_ore', 2) // tin is the limiting input

    game.player.smelt('bronze_bar', furnace)
    for (let i = 0; i < 30; i++) game.tick()

    expect(game.player.inventory.count('bronze_bar')).toBe(2)
    expect(game.player.inventory.count('tin_ore')).toBe(0)
    expect(game.player.inventory.count('copper_ore')).toBe(3) // leftover copper
    expect(game.player.action).toBeNull()
  })
})

describe('smelting: iron bars', () => {
  it('produces a deterministic mix of bars and failures, losing ore on failure', () => {
    const game = makeGame()
    const furnace = furnaceAt(game, FURNACE.x, FURNACE.y)
    game.player.skills.addXp('smithing', xpForLevel(15)) // iron requires level 15
    game.player.inventory.add('iron_ore', 20)
    const smelted: boolean[] = []
    game.events.on('oreSmelted', ({ success }) => smelted.push(success))

    expect(game.player.smelt('iron_bar', furnace)).toBe(true)
    for (let i = 0; i < 90; i++) game.tick() // 4 ticks per attempt * 20 + walking

    expect(game.player.inventory.count('iron_ore')).toBe(0) // all ore consumed
    const bars = game.player.inventory.count('iron_bar')
    const failures = smelted.filter((success) => !success).length
    expect(smelted).toHaveLength(20)
    expect(bars).toBeGreaterThan(0) // 0.5 success: a mix
    expect(failures).toBeGreaterThan(0)
    expect(bars + failures).toBe(20)
    expect(game.player.skills.getXp('smithing')).toBe(
      xpForLevel(15) + bars * smeltingRecipes.iron_bar.xp,
    )
  })
})

describe('smelting: validation', () => {
  it('emits level_too_low for iron at smithing 1', () => {
    const game = makeGame()
    const furnace = furnaceAt(game, FURNACE.x, FURNACE.y)
    game.player.inventory.add('iron_ore')
    const failures = collectFailures(game)

    expect(game.player.smelt('iron_bar', furnace)).toBe(false)
    expect(failures).toEqual(['level_too_low'])
  })

  it('emits missing_ingredient when an ore input is absent', () => {
    const game = makeGame()
    const furnace = furnaceAt(game, FURNACE.x, FURNACE.y)
    game.player.inventory.add('copper_ore') // bronze also needs tin
    const failures = collectFailures(game)

    expect(game.player.smelt('bronze_bar', furnace)).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('emits invalid_source for objects that are not furnaces', () => {
    const game = makeGame([{ defId: 'bank_booth', x: 6, y: 2 }])
    game.player.inventory.add('copper_ore')
    game.player.inventory.add('tin_ore')
    const failures = collectFailures(game)

    expect(game.player.smelt('bronze_bar', furnaceAt(game, 6, 2))).toBe(false)
    expect(failures).toEqual(['invalid_source'])
  })

  it('throws on items without a smelting recipe', () => {
    const game = makeGame()
    const furnace = furnaceAt(game, FURNACE.x, FURNACE.y)
    expect(() => game.player.smelt('logs', furnace)).toThrow(/Unknown smelting recipe/)
  })

  it('isValidSmeltingSource is true only for furnaces', () => {
    const game = makeGame([FURNACE, { defId: 'cooking_range', x: 8, y: 2 }])
    expect(isValidSmeltingSource(furnaceAt(game, FURNACE.x, FURNACE.y))).toBe(true)
    expect(isValidSmeltingSource(furnaceAt(game, 8, 2))).toBe(false)
  })
})

describe('smelting: world', () => {
  it('furnaces block movement', () => {
    const game = makeGame()
    expect(game.world.isWalkable(FURNACE.x, FURNACE.y)).toBe(false)
    expect(game.player.walkTo(FURNACE.x, FURNACE.y)).toBe(false)
  })
})

describe('smelting: interruption', () => {
  it('walkTo cancels smelting', () => {
    const game = makeGame()
    const furnace = furnaceAt(game, FURNACE.x, FURNACE.y)
    game.player.inventory.add('copper_ore', 5)
    game.player.inventory.add('tin_ore', 5)

    game.player.smelt('bronze_bar', furnace)
    game.tick()
    expect(game.player.walkTo(2, 3)).toBe(true)
    expect(game.player.action).toBeNull()

    for (let i = 0; i < 12; i++) game.tick()
    expect(game.player.inventory.count('copper_ore')).toBe(5)
    expect(game.player.inventory.count('tin_ore')).toBe(5)
  })
})

describe('smelting: determinism', () => {
  it('same seed + same commands produce identical results', () => {
    const run = (): { bars: number; xp: number } => {
      const game = makeGame([FURNACE], 1234)
      const furnace = furnaceAt(game, FURNACE.x, FURNACE.y)
      game.player.skills.addXp('smithing', xpForLevel(15))
      game.player.inventory.add('iron_ore', 15)
      game.player.smelt('iron_bar', furnace)
      for (let i = 0; i < 70; i++) game.tick()
      return {
        bars: game.player.inventory.count('iron_bar'),
        xp: game.player.skills.getXp('smithing'),
      }
    }

    const a = run()
    const b = run()
    expect(a).toEqual(b)
    expect(a.bars).toBeGreaterThan(0)
  })
})
