import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import type { ShopDef } from '../../content/types'
import { Game, type ObjectPlacement } from '../core/game'
import type { WorldObject } from '../world/worldObject'
import type { ActionFailReason } from './gathering'
import { getShopDef } from './shop'

// testMap spawn is (2, 2); row 2 is fully walkable from x=1 to x=14.
const COUNTER = { defId: 'shop_counter', x: 6, y: 2 }

/** Priced test shop, passed straight to shop.open (content stays free). */
const PRICED_SHOP: ShopDef = {
  id: 'test_priced_shop',
  name: 'Test Priced Shop',
  stock: [
    { itemId: 'logs', price: 5 },
    { itemId: 'feather', price: 2 },
  ],
}

function makeGame(objects: ObjectPlacement[] = [COUNTER], seed = 42): Game {
  return new Game({ seed, map: testMap, objects })
}

function objectAt(game: Game, x: number, y: number): WorldObject {
  const object = game.world.objectAt(x, y)
  if (!object) throw new Error(`no object at (${x}, ${y})`)
  return object
}

/** Walk to the counter and open the shop (asserts it opens). */
function openShop(game: Game): WorldObject {
  const counter = objectAt(game, COUNTER.x, COUNTER.y)
  expect(game.player.openShop(counter)).toBe(true)
  for (let i = 0; i < 20 && !game.shop.isOpen; i++) game.tick()
  expect(game.shop.isOpen).toBe(true)
  return counter
}

function collectFailures(game: Game): ActionFailReason[] {
  const reasons: ActionFailReason[] = []
  game.events.on('actionFailed', ({ reason }) => reasons.push(reason))
  return reasons
}

describe('shop: opening', () => {
  it('walks adjacent to the counter, then opens the counter shop', () => {
    const game = makeGame()
    const opened: Array<{ shopId: string; tick: number }> = []
    game.events.on('shopOpened', ({ shopId }) => opened.push({ shopId, tick: game.tickCount }))

    expect(game.player.openShop(objectAt(game, COUNTER.x, COUNTER.y))).toBe(true)
    expect(game.player.isMoving).toBe(true)
    expect(game.shop.isOpen).toBe(false)

    game.tick()
    game.tick()
    game.tick()
    expect(game.player.position).toEqual({ x: 5, y: 2 }) // adjacent
    expect(game.shop.isOpen).toBe(false) // opens on the next action tick

    game.tick()
    expect(game.shop.isOpen).toBe(true)
    expect(game.shop.current?.id).toBe('lumbridge_general_store')
    expect(opened).toEqual([{ shopId: 'lumbridge_general_store', tick: 4 }])
    expect(game.player.action).toBeNull()
  })

  it('emits invalid_source for objects without a shop', () => {
    const game = makeGame([{ defId: 'bank_booth', x: 6, y: 2 }])
    const failures = collectFailures(game)

    expect(game.player.openShop(objectAt(game, 6, 2))).toBe(false)
    expect(failures).toEqual(['invalid_source'])
  })

  it('shop counters block movement', () => {
    const game = makeGame()
    expect(game.world.isWalkable(COUNTER.x, COUNTER.y)).toBe(false)
    expect(game.player.walkTo(COUNTER.x, COUNTER.y)).toBe(false)
  })

  it('getShopDef throws on unknown shop ids', () => {
    expect(() => getShopDef('no_such_shop')).toThrow('Unknown shop id')
  })
})

describe('shop: buying free stock', () => {
  it('moves the item into the inventory at no cost', () => {
    const game = makeGame()
    openShop(game)
    const bought: Array<{ itemId: string; quantity: number; cost: number }> = []
    game.events.on('itemBought', (e) => bought.push(e))

    expect(game.shop.buy('bronze_axe')).toBe(1)
    expect(game.player.inventory.count('bronze_axe')).toBe(1)
    expect(game.player.inventory.count('coins')).toBe(0)
    expect(bought).toEqual([{ itemId: 'bronze_axe', quantity: 1, cost: 0 }])
  })

  it('stocks the whole starter kit and never sells out', () => {
    const game = makeGame()
    openShop(game)
    for (const { itemId, price } of game.shop.stock) {
      expect(price, `${itemId} is free`).toBe(0)
      expect(game.shop.buy(itemId)).toBe(1)
      expect(game.player.inventory.has(itemId)).toBe(true)
    }
    // Unlimited stock: buying again still works.
    expect(game.shop.buy('tinderbox')).toBe(1)
    expect(game.player.inventory.count('tinderbox')).toBe(2)
  })

  it('emits item_not_stocked for items the shop does not sell', () => {
    const game = makeGame()
    openShop(game)
    const failures = collectFailures(game)

    expect(game.shop.buy('logs')).toBe(0)
    expect(failures).toEqual(['item_not_stocked'])
  })

  it('respects inventory space and only reports what fit', () => {
    const game = makeGame()
    openShop(game)
    game.player.inventory.add('logs', 26) // 2 free slots left
    const failures = collectFailures(game)

    expect(game.shop.buy('bronze_axe', 5)).toBe(2)
    expect(game.player.inventory.count('bronze_axe')).toBe(2)
    expect(failures).toEqual(['inventory_full'])

    expect(game.shop.buy('bronze_axe')).toBe(0) // completely full now
    expect(failures).toEqual(['inventory_full', 'inventory_full'])
  })
})

describe('shop: buying priced stock', () => {
  it('charges coins per item bought', () => {
    const game = makeGame()
    game.shop.open(PRICED_SHOP)
    game.player.inventory.add('coins', 20)

    expect(game.shop.buy('logs', 2)).toBe(2) // 2 x 5 = 10 coins
    expect(game.player.inventory.count('logs')).toBe(2)
    expect(game.player.inventory.count('coins')).toBe(10)
  })

  it('clamps to what the player can afford and emits not_enough_coins', () => {
    const game = makeGame()
    game.shop.open(PRICED_SHOP)
    game.player.inventory.add('coins', 12)
    const failures = collectFailures(game)

    expect(game.shop.buy('logs', 3)).toBe(2) // afford 2 of 3 at 5 gp
    expect(game.player.inventory.count('coins')).toBe(2)
    expect(failures).toEqual(['not_enough_coins'])

    expect(game.shop.buy('logs')).toBe(0) // 2 coins left, needs 5
    expect(failures).toEqual(['not_enough_coins', 'not_enough_coins'])
    expect(game.player.inventory.count('coins')).toBe(2)
  })

  it('does not charge for items that did not fit', () => {
    const game = makeGame()
    game.shop.open(PRICED_SHOP)
    game.player.inventory.add('coins', 20)
    game.player.inventory.add('logs', 26) // coins + 26 logs = 1 free slot
    const failures = collectFailures(game)

    expect(game.shop.buy('logs', 3)).toBe(1)
    expect(game.player.inventory.count('coins')).toBe(15) // paid for 1
    expect(failures).toEqual(['inventory_full'])
  })
})

describe('shop: closed guard and interface exclusivity', () => {
  it('buy fails with shop_closed while shut', () => {
    const game = makeGame()
    const failures = collectFailures(game)

    expect(game.shop.buy('bronze_axe')).toBe(0)
    expect(failures).toEqual(['shop_closed'])
    expect(game.player.inventory.count('bronze_axe')).toBe(0)
  })

  it('walking away closes the shop', () => {
    const game = makeGame()
    openShop(game)
    const closed: number[] = []
    game.events.on('shopClosed', () => closed.push(game.tickCount))

    expect(game.player.walkTo(2, 2)).toBe(true)
    expect(game.shop.isOpen).toBe(true) // closes at tick granularity
    game.tick()
    expect(game.shop.isOpen).toBe(false)
    expect(closed).toHaveLength(1)

    const failures = collectFailures(game)
    expect(game.shop.buy('bronze_axe')).toBe(0)
    expect(failures).toEqual(['shop_closed'])
  })

  it('close closes it explicitly and is idempotent', () => {
    const game = makeGame()
    openShop(game)
    game.shop.close()
    expect(game.shop.isOpen).toBe(false)
    game.shop.close() // no-op, no duplicate event
  })

  it('opening the shop closes the bank and vice versa', () => {
    const game = makeGame()
    game.bank.open()
    expect(game.bank.isOpen).toBe(true)

    game.shop.open(getShopDef('lumbridge_general_store'))
    expect(game.shop.isOpen).toBe(true)
    expect(game.bank.isOpen).toBe(false)

    game.bank.open()
    expect(game.bank.isOpen).toBe(true)
    expect(game.shop.isOpen).toBe(false)
  })
})
