import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { EventBus } from '../core/eventBus'
import { Game } from '../core/game'
import { GROUND_ITEM_DESPAWN_TICKS, GroundItemManager } from './groundItems'

function makeGame(seed = 42): Game {
  return new Game({ seed, map: testMap })
}

/** Tick until `done` returns true (throws after `max` ticks). */
function tickUntil(game: Game, done: () => boolean, max = 300): void {
  for (let i = 0; i < max; i++) {
    game.tick()
    if (done()) return
  }
  throw new Error(`condition not met within ${max} ticks`)
}

describe('GroundItemManager', () => {
  it('adds and removes stacks with events', () => {
    const events = new EventBus()
    const manager = new GroundItemManager(events)
    const added: number[] = []
    const removed: Array<{ id: number; reason: string }> = []
    events.on('groundItemAdded', ({ id }) => added.push(id))
    events.on('groundItemRemoved', ({ id, reason }) => removed.push({ id, reason }))

    const bones = manager.add('bones', 1, 3, 4, 100)
    expect(manager.itemsAt(3, 4)).toEqual([bones])
    expect(added).toEqual([bones.id])

    expect(manager.remove(bones, 'picked_up')).toBe(true)
    expect(manager.remove(bones, 'picked_up')).toBe(false) // already gone
    expect(manager.items).toEqual([])
    expect(removed).toEqual([{ id: bones.id, reason: 'picked_up' }])
  })

  it('rejects unknown item ids and bad quantities', () => {
    const manager = new GroundItemManager(new EventBus())
    expect(() => manager.add('not_an_item', 1, 0, 0, 10)).toThrow(/Unknown item/)
    expect(() => manager.add('bones', 0, 0, 0, 10)).toThrow(/positive integer/)
  })

  it('despawns stacks once their tick is reached (via Game.tick)', () => {
    const game = makeGame()
    const reasons: string[] = []
    game.events.on('groundItemRemoved', ({ reason }) => reasons.push(reason))
    game.groundItems.add('bones', 1, 3, 3, game.tickCount + GROUND_ITEM_DESPAWN_TICKS)

    tickUntil(game, () => game.groundItems.items.length === 0)
    expect(game.tickCount).toBe(GROUND_ITEM_DESPAWN_TICKS)
    expect(reasons).toEqual(['despawned'])
  })
})

describe('player.pickUp', () => {
  it('walks to the item tile and picks it up into the inventory', () => {
    const game = makeGame()
    const coins = game.groundItems.add('coins', 5, 6, 2, 1000)
    const removed: string[] = []
    game.events.on('groundItemRemoved', ({ reason }) => removed.push(reason))

    expect(game.player.pickUp(coins)).toBe(true)
    expect(game.player.isMoving).toBe(true)
    tickUntil(game, () => game.player.inventory.count('coins') > 0)

    expect(game.player.position).toEqual({ x: 6, y: 2 })
    expect(game.player.inventory.count('coins')).toBe(5)
    expect(game.groundItems.items).toEqual([])
    expect(removed).toEqual(['picked_up'])
  })

  it('fails with inventory_full and leaves the stack on the ground', () => {
    const game = makeGame()
    game.player.inventory.add('logs', 28)
    const bones = game.groundItems.add('bones', 1, 3, 2, 1000)
    const failures: string[] = []
    game.events.on('actionFailed', ({ reason }) => failures.push(reason))

    expect(game.player.pickUp(bones)).toBe(true)
    tickUntil(game, () => game.player.action === null && !game.player.isMoving)

    expect(failures).toEqual(['inventory_full'])
    expect(game.groundItems.contains(bones)).toBe(true)
  })

  it('partially picks up a multi-quantity stack when short on space', () => {
    const game = makeGame()
    game.player.inventory.add('logs', 26) // 2 slots free
    const bones = game.groundItems.add('bones', 3, 3, 2, 1000)
    const failures: string[] = []
    game.events.on('actionFailed', ({ reason }) => failures.push(reason))

    game.player.pickUp(bones)
    tickUntil(game, () => game.player.inventory.count('bones') > 0)

    expect(game.player.inventory.count('bones')).toBe(2)
    expect(bones.quantity).toBe(1) // remainder stays on the ground
    expect(game.groundItems.contains(bones)).toBe(true)
    expect(failures).toEqual(['inventory_full'])
  })

  it('ends silently when the item despawns before arrival', () => {
    const game = makeGame()
    const bones = game.groundItems.add('bones', 1, 10, 10, game.tickCount + 2)
    const failures: string[] = []
    game.events.on('actionFailed', ({ reason }) => failures.push(reason))

    game.player.pickUp(bones)
    tickUntil(game, () => game.player.action === null && !game.player.isMoving)

    expect(game.player.inventory.count('bones')).toBe(0)
    expect(failures).toEqual([])
  })
})
