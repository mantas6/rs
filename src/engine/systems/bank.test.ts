import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { Game, type ObjectPlacement } from '../core/game'
import type { WorldObject } from '../world/worldObject'
import type { ActionFailReason } from './gathering'

// testMap spawn is (2, 2); row 2 is fully walkable from x=1 to x=14.
const BOOTH = { defId: 'bank_booth', x: 6, y: 2 }

function makeGame(objects: ObjectPlacement[] = [BOOTH], seed = 42): Game {
  return new Game({ seed, map: testMap, objects })
}

function objectAt(game: Game, x: number, y: number): WorldObject {
  const object = game.world.objectAt(x, y)
  if (!object) throw new Error(`no object at (${x}, ${y})`)
  return object
}

/** Walk to the booth and open the bank (asserts it opens). */
function openBank(game: Game): WorldObject {
  const booth = objectAt(game, BOOTH.x, BOOTH.y)
  expect(game.player.openBank(booth)).toBe(true)
  for (let i = 0; i < 20 && !game.bank.isOpen; i++) game.tick()
  expect(game.bank.isOpen).toBe(true)
  return booth
}

function collectFailures(game: Game): ActionFailReason[] {
  const reasons: ActionFailReason[] = []
  game.events.on('actionFailed', ({ reason }) => reasons.push(reason))
  return reasons
}

describe('bank: opening', () => {
  it('walks adjacent to the booth, then opens', () => {
    const game = makeGame()
    const opened: number[] = []
    game.events.on('bankOpened', () => opened.push(game.tickCount))

    expect(game.player.openBank(objectAt(game, BOOTH.x, BOOTH.y))).toBe(true)
    expect(game.player.isMoving).toBe(true)
    expect(game.bank.isOpen).toBe(false)

    game.tick()
    game.tick()
    game.tick()
    expect(game.player.position).toEqual({ x: 5, y: 2 }) // adjacent
    expect(game.bank.isOpen).toBe(false) // opens on the next action tick

    game.tick()
    expect(game.bank.isOpen).toBe(true)
    expect(opened).toEqual([4])
    expect(game.player.action).toBeNull()
  })

  it('emits invalid_source for objects that are not bank booths', () => {
    const game = makeGame([{ defId: 'cooking_range', x: 6, y: 2 }])
    const failures = collectFailures(game)

    expect(game.player.openBank(objectAt(game, 6, 2))).toBe(false)
    expect(failures).toEqual(['invalid_source'])
  })

  it('bank booths block movement', () => {
    const game = makeGame()
    expect(game.world.isWalkable(BOOTH.x, BOOTH.y)).toBe(false)
    expect(game.player.walkTo(BOOTH.x, BOOTH.y)).toBe(false)
  })
})

describe('bank: deposit and withdraw', () => {
  it('round-trips non-stackables, which occupy one inventory slot each', () => {
    const game = makeGame()
    openBank(game)
    game.player.inventory.add('logs', 5)

    expect(game.bank.deposit('logs', 3)).toBe(3)
    expect(game.bank.count('logs')).toBe(3)
    expect(game.player.inventory.count('logs')).toBe(2)
    expect(game.bank.items).toEqual([{ itemId: 'logs', quantity: 3 }]) // banked items stack

    expect(game.bank.withdraw('logs', 2)).toBe(2)
    expect(game.bank.count('logs')).toBe(1)
    expect(game.player.inventory.count('logs')).toBe(4)
    expect(game.player.inventory.freeSlots).toBe(24) // one slot per log
  })

  it('round-trips stackables in a single inventory slot', () => {
    const game = makeGame()
    openBank(game)
    game.player.inventory.add('coins', 100)

    expect(game.bank.deposit('coins', 'all')).toBe(100)
    expect(game.player.inventory.count('coins')).toBe(0)
    expect(game.bank.withdraw('coins', 60)).toBe(60)
    expect(game.player.inventory.count('coins')).toBe(60)
    expect(game.player.inventory.freeSlots).toBe(27) // one stack slot
    expect(game.bank.count('coins')).toBe(40)
  })

  it("supports 'all' quantities and clamps to what is available", () => {
    const game = makeGame()
    openBank(game)
    game.player.inventory.add('logs', 4)

    expect(game.bank.deposit('logs', 99)).toBe(4) // clamped to held
    expect(game.bank.withdraw('logs', 'all')).toBe(4)
    expect(game.bank.count('logs')).toBe(0)
    expect(game.bank.items).toEqual([]) // emptied entries are removed
    expect(game.bank.withdraw('logs', 'all')).toBe(0) // nothing banked
    expect(game.bank.deposit('coins', 'all')).toBe(0) // nothing held
  })

  it('depositAll banks the whole inventory', () => {
    const game = makeGame()
    openBank(game)
    game.player.inventory.add('logs', 3)
    game.player.inventory.add('coins', 100)
    game.player.inventory.add('tinderbox')

    expect(game.bank.depositAll()).toBe(104)
    expect(game.player.inventory.freeSlots).toBe(28)
    expect(game.bank.count('logs')).toBe(3)
    expect(game.bank.count('coins')).toBe(100)
    expect(game.bank.count('tinderbox')).toBe(1)
  })

  it('withdraw respects inventory space for non-stackables', () => {
    const game = makeGame()
    openBank(game)
    game.player.inventory.add('logs', 5)
    game.bank.deposit('logs', 'all')
    game.player.inventory.add('oak_logs', 27) // 1 free slot left
    const failures = collectFailures(game)

    expect(game.bank.withdraw('logs', 5)).toBe(1)
    expect(failures).toEqual(['inventory_full'])
    expect(game.player.inventory.count('logs')).toBe(1)
    expect(game.bank.count('logs')).toBe(4) // the rest stays banked
  })

  it('emits bankChanged with the new bank total', () => {
    const game = makeGame()
    openBank(game)
    game.player.inventory.add('logs', 3)
    const changes: Array<{ itemId: string; quantity: number }> = []
    game.events.on('bankChanged', (e) => changes.push(e))

    game.bank.deposit('logs', 2)
    game.bank.withdraw('logs', 1)
    expect(changes).toEqual([
      { itemId: 'logs', quantity: 2 },
      { itemId: 'logs', quantity: 1 },
    ])
  })
})

describe('bank: closed guard', () => {
  it('deposit and withdraw fail with bank_closed while shut', () => {
    const game = makeGame()
    game.player.inventory.add('logs', 3)
    const failures = collectFailures(game)

    expect(game.bank.deposit('logs', 'all')).toBe(0)
    expect(game.bank.withdraw('logs', 1)).toBe(0)
    expect(game.bank.depositAll()).toBe(0)
    expect(failures).toEqual(['bank_closed', 'bank_closed', 'bank_closed'])
    expect(game.player.inventory.count('logs')).toBe(3)
  })

  it('walking away closes the bank', () => {
    const game = makeGame()
    openBank(game)
    const closed: number[] = []
    game.events.on('bankClosed', () => closed.push(game.tickCount))

    expect(game.player.walkTo(2, 2)).toBe(true)
    expect(game.bank.isOpen).toBe(true) // closes at tick granularity
    game.tick()
    expect(game.bank.isOpen).toBe(false)
    expect(closed).toHaveLength(1)

    const failures = collectFailures(game)
    expect(game.bank.deposit('logs', 1)).toBe(0)
    expect(failures).toEqual(['bank_closed'])
  })

  it('closeBank closes it explicitly', () => {
    const game = makeGame()
    openBank(game)
    game.bank.close()
    expect(game.bank.isOpen).toBe(false)
    game.bank.close() // no-op, no duplicate event
  })
})
