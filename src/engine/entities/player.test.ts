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
