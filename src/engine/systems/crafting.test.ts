import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { craftingRecipes } from '../../content/recipes'
import { Game, type ObjectPlacement } from '../core/game'
import type { WorldObject } from '../world/worldObject'
import { isValidTanningSource } from './crafting'
import type { ActionFailReason } from './gathering'
import { xpForLevel } from './skills'

// testMap spawn is (2, 2); row 2 is fully walkable from x=1 to x=14.
const TANNERY = { defId: 'tannery', x: 6, y: 2 }

function makeGame(objects: ObjectPlacement[] = [TANNERY], seed = 42): Game {
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

/** Give the player a full sewing kit: needle, leather and thread. */
function stockSewingKit(game: Game, leather = 3, thread = 5): void {
  game.player.inventory.add('needle')
  game.player.inventory.add('leather', leather)
  game.player.inventory.add('thread', thread)
}

describe('tanning: cowhide into leather', () => {
  it('walks adjacent first, then tans one leather per few ticks with no xp', () => {
    const game = makeGame()
    const tannery = objectAt(game, TANNERY.x, TANNERY.y)
    game.player.inventory.add('cowhide', 3)
    const tanned: string[] = []
    game.events.on('hideTanned', ({ leatherItemId }) => tanned.push(leatherItemId))

    expect(game.player.tan('cowhide', tannery)).toBe(true)
    expect(game.player.isMoving).toBe(true)

    // Nothing tans while walking to the tannery.
    game.tick()
    game.tick()
    game.tick()
    expect(game.player.position).toEqual({ x: 5, y: 2 }) // adjacent to the tannery
    expect(game.player.inventory.count('leather')).toBe(0)

    for (let i = 0; i < 20; i++) game.tick()
    expect(game.player.inventory.count('leather')).toBe(3)
    expect(game.player.inventory.count('cowhide')).toBe(0)
    // Tanning grants no Crafting xp (like OSRS): the xp is from sewing.
    expect(game.player.skills.getXp('crafting')).toBe(0)
    expect(tanned).toEqual(['leather', 'leather', 'leather'])
    expect(game.player.action).toBeNull() // ends when the hides run out
  })
})

describe('tanning: validation', () => {
  it('emits missing_ingredient without a hide', () => {
    const game = makeGame()
    const tannery = objectAt(game, TANNERY.x, TANNERY.y)
    const failures = collectFailures(game)

    expect(game.player.tan('cowhide', tannery)).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('emits invalid_source for objects that are not tanneries', () => {
    const game = makeGame([{ defId: 'bank_booth', x: 6, y: 2 }])
    game.player.inventory.add('cowhide')
    const failures = collectFailures(game)

    expect(game.player.tan('cowhide', objectAt(game, 6, 2))).toBe(false)
    expect(failures).toEqual(['invalid_source'])
  })

  it('throws on hides without a tanning recipe', () => {
    const game = makeGame()
    const tannery = objectAt(game, TANNERY.x, TANNERY.y)
    expect(() => game.player.tan('logs', tannery)).toThrow(/Unknown tanning recipe/)
  })

  it('isValidTanningSource is true only for tanneries', () => {
    const game = makeGame([TANNERY, { defId: 'furnace', x: 8, y: 2 }])
    expect(isValidTanningSource(objectAt(game, TANNERY.x, TANNERY.y))).toBe(true)
    expect(isValidTanningSource(objectAt(game, 8, 2))).toBe(false)
  })
})

describe('tanning: world', () => {
  it('tanneries block movement', () => {
    const game = makeGame()
    expect(game.world.isWalkable(TANNERY.x, TANNERY.y)).toBe(false)
    expect(game.player.walkTo(TANNERY.x, TANNERY.y)).toBe(false)
  })
})

describe('tanning: interruption', () => {
  it('walkTo cancels tanning without consuming hides', () => {
    const game = makeGame()
    const tannery = objectAt(game, TANNERY.x, TANNERY.y)
    game.player.inventory.add('cowhide', 5)

    game.player.tan('cowhide', tannery)
    game.tick()
    expect(game.player.walkTo(2, 3)).toBe(true)
    expect(game.player.action).toBeNull()

    for (let i = 0; i < 12; i++) game.tick()
    expect(game.player.inventory.count('cowhide')).toBe(5)
    expect(game.player.inventory.count('leather')).toBe(0)
  })
})

describe('sewing: leather gloves', () => {
  it('sews one item per few ticks from the inventory, no walking', () => {
    const game = makeGame()
    stockSewingKit(game, 3, 5)
    const crafted: string[] = []
    game.events.on('itemCrafted', ({ productItemId }) => crafted.push(productItemId))

    expect(game.player.craft('leather_gloves')).toBe(true)
    expect(game.player.isMoving).toBe(false) // sewn where you stand

    for (let i = 0; i < 20; i++) game.tick()
    expect(game.player.inventory.count('leather_gloves')).toBe(3)
    expect(game.player.inventory.count('leather')).toBe(0)
    expect(game.player.inventory.count('thread')).toBe(2) // 1 thread per glove
    expect(game.player.inventory.count('needle')).toBe(1) // needle is not consumed
    expect(game.player.skills.getXp('crafting')).toBe(3 * craftingRecipes.leather_gloves.xp)
    expect(crafted).toEqual(['leather_gloves', 'leather_gloves', 'leather_gloves'])
    expect(game.player.action).toBeNull() // ends when the leather runs out
  })

  it('stops when the thread runs out even with leather to spare', () => {
    const game = makeGame()
    stockSewingKit(game, 5, 2) // thread is the limiting material

    game.player.craft('leather_gloves')
    for (let i = 0; i < 30; i++) game.tick()

    expect(game.player.inventory.count('leather_gloves')).toBe(2)
    expect(game.player.inventory.count('thread')).toBe(0)
    expect(game.player.inventory.count('leather')).toBe(3) // leftover leather
    expect(game.player.action).toBeNull()
  })

  it('a crafted leather item can be equipped', () => {
    const game = makeGame()
    stockSewingKit(game, 1, 1)

    game.player.craft('leather_gloves')
    for (let i = 0; i < 6; i++) game.tick()

    expect(game.player.inventory.count('leather_gloves')).toBe(1)
    expect(game.player.equip('leather_gloves')).toBe(true)
    expect(game.player.equipment.get('hands')?.itemId).toBe('leather_gloves')
  })
})

describe('sewing: higher-level items', () => {
  it('sews a leather body once crafting is high enough', () => {
    const game = makeGame()
    game.player.skills.addXp('crafting', xpForLevel(14)) // body requires level 14
    stockSewingKit(game, 1, 1)

    game.player.craft('leather_body')
    for (let i = 0; i < 6; i++) game.tick()

    expect(game.player.inventory.count('leather_body')).toBe(1)
    expect(game.player.skills.getXp('crafting')).toBe(
      xpForLevel(14) + craftingRecipes.leather_body.xp,
    )
  })
})

describe('sewing: validation', () => {
  it('emits missing_tool without a needle', () => {
    const game = makeGame()
    game.player.inventory.add('leather')
    game.player.inventory.add('thread')
    const failures = collectFailures(game)

    expect(game.player.craft('leather_gloves')).toBe(false)
    expect(failures).toEqual(['missing_tool'])
  })

  it('emits level_too_low for a leather body at crafting 1', () => {
    const game = makeGame()
    stockSewingKit(game, 1, 1)
    const failures = collectFailures(game)

    expect(game.player.craft('leather_body')).toBe(false)
    expect(failures).toEqual(['level_too_low'])
  })

  it('emits missing_ingredient without leather', () => {
    const game = makeGame()
    game.player.inventory.add('needle')
    game.player.inventory.add('thread')
    const failures = collectFailures(game)

    expect(game.player.craft('leather_gloves')).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('emits missing_ingredient without thread', () => {
    const game = makeGame()
    game.player.inventory.add('needle')
    game.player.inventory.add('leather')
    const failures = collectFailures(game)

    expect(game.player.craft('leather_gloves')).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('throws on products without a crafting recipe', () => {
    const game = makeGame()
    expect(() => game.player.craft('logs')).toThrow(/Unknown crafting recipe/)
  })
})

describe('sewing: interruption', () => {
  it('walkTo cancels sewing without consuming materials', () => {
    const game = makeGame()
    stockSewingKit(game, 5, 5)

    game.player.craft('leather_gloves')
    game.tick()
    expect(game.player.walkTo(2, 3)).toBe(true)
    expect(game.player.action).toBeNull()

    for (let i = 0; i < 12; i++) game.tick()
    expect(game.player.inventory.count('leather')).toBe(5)
    expect(game.player.inventory.count('thread')).toBe(5)
    expect(game.player.inventory.count('leather_gloves')).toBe(0)
  })
})

describe('crafting: determinism', () => {
  it('same seed + same commands produce identical results', () => {
    const run = (): { gloves: number; xp: number } => {
      const game = makeGame([TANNERY], 1234)
      const tannery = objectAt(game, TANNERY.x, TANNERY.y)
      game.player.inventory.add('cowhide', 3)
      game.player.inventory.add('needle')
      game.player.inventory.add('thread', 3)

      game.player.tan('cowhide', tannery)
      for (let i = 0; i < 20; i++) game.tick()
      game.player.craft('leather_gloves')
      for (let i = 0; i < 20; i++) game.tick()

      return {
        gloves: game.player.inventory.count('leather_gloves'),
        xp: game.player.skills.getXp('crafting'),
      }
    }

    const a = run()
    const b = run()
    expect(a).toEqual(b)
    expect(a.gloves).toBe(3)
  })
})
