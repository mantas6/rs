import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { Game } from '../core/game'
import type { PlayerAction } from './player'

function makeGame(): Game {
  return new Game({ seed: 7, map: testMap })
}

class CountdownAction implements PlayerAction {
  ticksRun = 0

  constructor(private remaining: number) {}

  onTick(): boolean {
    this.ticksRun++
    this.remaining--
    return this.remaining > 0
  }
}

describe('Player movement', () => {
  it('walks 1 tile per tick toward the target', () => {
    const game = makeGame()
    expect(game.player.walkTo(6, 2)).toBe(true)
    expect(game.player.isMoving).toBe(true)

    const expected = [
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
      { x: 6, y: 2 },
    ]
    for (const pos of expected) {
      game.tick()
      expect(game.player.position).toEqual(pos)
    }
    expect(game.player.isMoving).toBe(false)
  })

  it('runs 2 tiles per tick, taking a single step on an odd final tick', () => {
    const game = makeGame()
    game.player.setRun(true)
    expect(game.player.walkTo(7, 2)).toBe(true) // path of 5 tiles

    game.tick()
    expect(game.player.position).toEqual({ x: 4, y: 2 })
    game.tick()
    expect(game.player.position).toEqual({ x: 6, y: 2 })
    game.tick()
    expect(game.player.position).toEqual({ x: 7, y: 2 })
    expect(game.player.isMoving).toBe(false)
  })

  it('replaces the movement queue when walkTo is called mid-path', () => {
    const game = makeGame()
    game.player.walkTo(6, 2)
    game.tick()
    expect(game.player.position).toEqual({ x: 3, y: 2 })

    expect(game.player.walkTo(3, 4)).toBe(true)
    game.tick()
    expect(game.player.position).toEqual({ x: 3, y: 3 })
    game.tick()
    expect(game.player.position).toEqual({ x: 3, y: 4 })
    expect(game.player.isMoving).toBe(false)
  })

  it('returns false for an unreachable target and does not move', () => {
    const game = makeGame()
    // (5, 4) is inside the sealed pocket of testMap.
    expect(game.player.walkTo(5, 4)).toBe(false)
    expect(game.player.isMoving).toBe(false)
    game.tick()
    expect(game.player.position).toEqual({ x: 2, y: 2 })
  })

  it('returns false for a blocked target tile', () => {
    const game = makeGame()
    expect(game.player.walkTo(0, 0)).toBe(false)
    expect(game.player.isMoving).toBe(false)
  })

  it('stop() halts movement immediately', () => {
    const game = makeGame()
    game.player.walkTo(6, 2)
    game.tick()
    game.player.stop()
    expect(game.player.isMoving).toBe(false)
    game.tick()
    expect(game.player.position).toEqual({ x: 3, y: 2 })
  })

  it('emits playerMoved with the new position on each movement tick', () => {
    const game = makeGame()
    const moves: Array<{ x: number; y: number }> = []
    game.events.on('playerMoved', (pos) => moves.push(pos))

    game.player.walkTo(4, 2)
    game.tick()
    game.tick()
    game.tick() // idle tick: no event
    expect(moves).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ])
  })
})

describe('Player actions', () => {
  it('ticks the current action while idle and clears it when done', () => {
    const game = makeGame()
    const action = new CountdownAction(3)
    game.player.setAction(action)

    game.tick()
    game.tick()
    expect(action.ticksRun).toBe(2)
    expect(game.player.action).toBe(action)

    game.tick()
    expect(action.ticksRun).toBe(3)
    expect(game.player.action).toBeNull()

    game.tick()
    expect(action.ticksRun).toBe(3)
  })

  it('does not tick the action while moving', () => {
    const game = makeGame()
    const action = new CountdownAction(99)
    game.player.walkTo(4, 2)
    game.player.setAction(action)
    game.tick()
    expect(action.ticksRun).toBe(0)
    expect(game.player.position).toEqual({ x: 3, y: 2 })
  })

  it('walkTo cancels the current action', () => {
    const game = makeGame()
    const action = new CountdownAction(99)
    game.player.setAction(action)
    expect(game.player.walkTo(4, 2)).toBe(true)
    expect(game.player.action).toBeNull()
  })
})

describe('Player.eat', () => {
  it('consumes the food and heals damaged hitpoints', () => {
    const game = makeGame()
    game.player.inventory.add('shrimps') // heals 3
    game.player.skills.boost('hitpoints', -5) // 10 -> 5
    const eaten: Array<{ itemId: string; healed: number; hpAfter: number }> = []
    game.events.on('itemEaten', (e) => eaten.push(e))

    expect(game.player.eat(0)).toBe(true)
    expect(game.player.skills.getCurrentLevel('hitpoints')).toBe(8)
    expect(game.player.inventory.count('shrimps')).toBe(0)
    expect(eaten).toEqual([{ itemId: 'shrimps', healed: 3, hpAfter: 8 }])
  })

  it('caps healing at the base hitpoints level and still consumes the food', () => {
    const game = makeGame()
    game.player.inventory.add('shrimps')
    game.player.skills.boost('hitpoints', -1) // 10 -> 9
    const eaten: Array<{ itemId: string; healed: number; hpAfter: number }> = []
    game.events.on('itemEaten', (e) => eaten.push(e))

    expect(game.player.eat(0)).toBe(true)
    expect(game.player.skills.getCurrentLevel('hitpoints')).toBe(10)
    expect(eaten).toEqual([{ itemId: 'shrimps', healed: 1, hpAfter: 10 }])
  })

  it('emits actionFailed: not_food for non-food items and keeps them', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    const failures: string[] = []
    game.events.on('actionFailed', (e) => failures.push(e.reason))

    expect(game.player.eat(0)).toBe(false)
    expect(failures).toEqual(['not_food'])
    expect(game.player.inventory.count('tinderbox')).toBe(1)
  })

  it('returns false for an empty slot without emitting', () => {
    const game = makeGame()
    const failures: string[] = []
    game.events.on('actionFailed', (e) => failures.push(e.reason))
    expect(game.player.eat(0)).toBe(false)
    expect(failures).toEqual([])
  })
})

describe('Player.drop', () => {
  it('drops the whole stack on the player tile with a despawn timer', () => {
    const game = makeGame()
    game.player.inventory.add('coins', 25)
    const dropped: Array<{ itemId: string; quantity: number; x: number; y: number }> = []
    game.events.on('itemDropped', (e) => dropped.push(e))
    game.tick() // advance so the despawn timer counts from a nonzero tick

    expect(game.player.drop(0)).toBe(true)
    expect(game.player.inventory.count('coins')).toBe(0)
    const onGround = game.groundItems.itemsAt(game.player.x, game.player.y)
    expect(onGround).toHaveLength(1)
    expect(onGround[0].itemId).toBe('coins')
    expect(onGround[0].quantity).toBe(25)
    expect(onGround[0].despawnAtTick).toBe(game.tickCount + 200)
    expect(dropped).toEqual([{ itemId: 'coins', quantity: 25, x: game.player.x, y: game.player.y }])
  })

  it('returns false for an empty slot', () => {
    const game = makeGame()
    expect(game.player.drop(0)).toBe(false)
    expect(game.groundItems.items).toHaveLength(0)
  })
})
