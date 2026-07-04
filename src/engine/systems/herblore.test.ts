import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { herbCleaningRecipes, potionRecipes } from '../../content/recipes'
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

/** Raise the player's base Herblore level by granting the xp for `level`. */
function setHerblore(game: Game, level: number): void {
  game.player.skills.addXp('herblore', xpForLevel(level))
}

describe('herblore: cleaning grimy herbs', () => {
  it('cleans one grimy herb per few ticks into a clean herb with xp', () => {
    const game = makeGame()
    setHerblore(game, 3) // grimy guam needs level 3
    game.player.inventory.add('grimy_guam', 3)
    const cleaned: string[] = []
    game.events.on('herbCleaned', ({ cleanItemId }) => cleaned.push(cleanItemId))

    expect(game.player.clean('grimy_guam')).toBe(true)
    expect(game.player.isMoving).toBe(false) // cleaned where you stand

    for (let i = 0; i < 20; i++) game.tick()
    expect(game.player.inventory.count('guam_leaf')).toBe(3)
    expect(game.player.inventory.count('grimy_guam')).toBe(0)
    expect(game.player.skills.getXp('herblore')).toBe(
      xpForLevel(3) + 3 * herbCleaningRecipes.grimy_guam.xp,
    )
    expect(cleaned).toEqual(['guam_leaf', 'guam_leaf', 'guam_leaf'])
    expect(game.player.action).toBeNull() // ends when the herbs run out
  })

  it('cleans tarromin only once Herblore is high enough', () => {
    const game = makeGame()
    setHerblore(game, 11) // grimy tarromin needs level 11
    game.player.inventory.add('grimy_tarromin', 1)

    game.player.clean('grimy_tarromin')
    for (let i = 0; i < 4; i++) game.tick()

    expect(game.player.inventory.count('tarromin')).toBe(1)
    expect(game.player.inventory.count('grimy_tarromin')).toBe(0)
  })
})

describe('herblore: unfinished potions', () => {
  it('mixes a clean herb and a vial of water into an unfinished potion (no xp)', () => {
    const game = makeGame()
    game.player.inventory.add('guam_leaf', 2)
    game.player.inventory.add('vial_of_water', 2)
    const mixed: string[] = []
    game.events.on('unfinishedPotionMixed', ({ unfinishedItemId }) => mixed.push(unfinishedItemId))

    expect(game.player.mixUnfinished('guam_potion_unf')).toBe(true)
    for (let i = 0; i < 10; i++) game.tick()

    expect(game.player.inventory.count('guam_potion_unf')).toBe(2)
    expect(game.player.inventory.count('guam_leaf')).toBe(0)
    expect(game.player.inventory.count('vial_of_water')).toBe(0)
    expect(game.player.skills.getXp('herblore')).toBe(0) // no xp for unfinished
    expect(mixed).toEqual(['guam_potion_unf', 'guam_potion_unf'])
  })

  it('stops when the vials run out even with herbs to spare', () => {
    const game = makeGame()
    game.player.inventory.add('guam_leaf', 3)
    game.player.inventory.add('vial_of_water', 1) // vials are the limiting item

    game.player.mixUnfinished('guam_potion_unf')
    for (let i = 0; i < 10; i++) game.tick()

    expect(game.player.inventory.count('guam_potion_unf')).toBe(1)
    expect(game.player.inventory.count('vial_of_water')).toBe(0)
    expect(game.player.inventory.count('guam_leaf')).toBe(2) // leftover herbs
    expect(game.player.action).toBeNull()
  })
})

describe('herblore: finished potions', () => {
  it('mixes an attack potion from unf + eye of newt with xp', () => {
    const game = makeGame()
    setHerblore(game, 3)
    game.player.inventory.add('guam_potion_unf', 2)
    game.player.inventory.add('eye_of_newt', 2)
    const mixed: string[] = []
    game.events.on('potionMixed', ({ potionItemId }) => mixed.push(potionItemId))

    expect(game.player.mixPotion('attack_potion')).toBe(true)
    for (let i = 0; i < 10; i++) game.tick()

    expect(game.player.inventory.count('attack_potion')).toBe(2)
    expect(game.player.inventory.count('guam_potion_unf')).toBe(0)
    expect(game.player.inventory.count('eye_of_newt')).toBe(0)
    expect(game.player.skills.getXp('herblore')).toBe(
      xpForLevel(3) + 2 * potionRecipes.attack_potion.xp,
    )
    expect(mixed).toEqual(['attack_potion', 'attack_potion'])
  })

  it('mixes a strength potion once Herblore is high enough', () => {
    const game = makeGame()
    setHerblore(game, 12) // strength potion needs level 12
    game.player.inventory.add('tarromin_potion_unf', 1)
    game.player.inventory.add('limpwurt_root', 1)

    game.player.mixPotion('strength_potion')
    for (let i = 0; i < 4; i++) game.tick()

    expect(game.player.inventory.count('strength_potion')).toBe(1)
    expect(game.player.skills.getXp('herblore')).toBe(
      xpForLevel(12) + potionRecipes.strength_potion.xp,
    )
  })
})

describe('herblore: validation', () => {
  it('emits level_too_low cleaning grimy guam below level 3', () => {
    const game = makeGame()
    game.player.inventory.add('grimy_guam')
    const failures = collectFailures(game)

    expect(game.player.clean('grimy_guam')).toBe(false)
    expect(failures).toEqual(['level_too_low'])
  })

  it('emits missing_ingredient cleaning without a grimy herb', () => {
    const game = makeGame()
    setHerblore(game, 3)
    const failures = collectFailures(game)

    expect(game.player.clean('grimy_guam')).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('emits missing_ingredient mixing an unfinished potion without a vial', () => {
    const game = makeGame()
    game.player.inventory.add('guam_leaf')
    const failures = collectFailures(game)

    expect(game.player.mixUnfinished('guam_potion_unf')).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('emits level_too_low mixing a strength potion below level 12', () => {
    const game = makeGame()
    game.player.inventory.add('tarromin_potion_unf')
    game.player.inventory.add('limpwurt_root')
    const failures = collectFailures(game)

    expect(game.player.mixPotion('strength_potion')).toBe(false)
    expect(failures).toEqual(['level_too_low'])
  })

  it('emits missing_ingredient mixing a finished potion without a secondary', () => {
    const game = makeGame()
    setHerblore(game, 3)
    game.player.inventory.add('guam_potion_unf')
    const failures = collectFailures(game)

    expect(game.player.mixPotion('attack_potion')).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('throws on ids without a herblore recipe', () => {
    const game = makeGame()
    expect(() => game.player.clean('guam_leaf')).toThrow(/Unknown herb cleaning recipe/)
    expect(() => game.player.mixUnfinished('attack_potion')).toThrow(
      /Unknown unfinished potion recipe/,
    )
    expect(() => game.player.mixPotion('guam_potion_unf')).toThrow(/Unknown potion recipe/)
  })
})

describe('herblore: interruption', () => {
  it('walkTo cancels cleaning without consuming herbs', () => {
    const game = makeGame()
    setHerblore(game, 3)
    game.player.inventory.add('grimy_guam', 5)

    game.player.clean('grimy_guam')
    game.tick()
    expect(game.player.walkTo(2, 3)).toBe(true)
    expect(game.player.action).toBeNull()

    for (let i = 0; i < 12; i++) game.tick()
    expect(game.player.inventory.count('grimy_guam')).toBe(5)
    expect(game.player.inventory.count('guam_leaf')).toBe(0)
  })
})

describe('herblore: potions boost combat and decay over ticks', () => {
  it('drinking an attack potion raises the effective attack level, then decays', () => {
    const game = makeGame()
    game.player.inventory.add('attack_potion')
    expect(game.player.skills.getCurrentLevel('attack')).toBe(1) // base

    expect(game.player.drink(0)).toBe(true)
    // Boost applied immediately, empty vial left behind.
    expect(game.player.skills.getCurrentLevel('attack')).toBe(4) // 1 + 3
    expect(game.player.inventory.count('attack_potion')).toBe(0)
    expect(game.player.inventory.count('empty_vial')).toBe(1)

    // The boost decays 1 level per minute (100 ticks), like every other boost.
    for (let i = 0; i < 100; i++) game.tick()
    expect(game.player.skills.getCurrentLevel('attack')).toBe(3)
    for (let i = 0; i < 300; i++) game.tick()
    expect(game.player.skills.getCurrentLevel('attack')).toBe(1) // fully restored
  })

  it('drinking a strength potion boosts strength for combat', () => {
    const game = makeGame()
    game.player.inventory.add('strength_potion')

    expect(game.player.drink(0)).toBe(true)
    expect(game.player.skills.getCurrentLevel('strength')).toBe(4) // 1 + 3
    expect(game.player.inventory.count('empty_vial')).toBe(1)
  })
})

describe('herblore: determinism', () => {
  it('same seed + same commands produce identical results', () => {
    const run = (): { potions: number; xp: number } => {
      const game = makeGame(1234)
      setHerblore(game, 3)
      game.player.inventory.add('grimy_guam', 2)
      game.player.inventory.add('vial_of_water', 2)
      game.player.inventory.add('eye_of_newt', 2)
      game.player.clean('grimy_guam')
      for (let i = 0; i < 10; i++) game.tick()
      game.player.mixUnfinished('guam_potion_unf')
      for (let i = 0; i < 10; i++) game.tick()
      game.player.mixPotion('attack_potion')
      for (let i = 0; i < 10; i++) game.tick()
      return {
        potions: game.player.inventory.count('attack_potion'),
        xp: game.player.skills.getXp('herblore'),
      }
    }

    const a = run()
    const b = run()
    expect(a).toEqual(b)
    expect(a.potions).toBe(2)
  })
})
