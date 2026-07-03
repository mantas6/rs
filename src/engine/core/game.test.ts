import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { Game } from './game'

describe('Game', () => {
  it('starts at tick 0 and increments per tick', () => {
    const game = new Game({ seed: 1, map: testMap })
    expect(game.tickCount).toBe(0)
    game.tick()
    game.tick()
    expect(game.tickCount).toBe(2)
  })

  it('spawns the player at the map spawn tile', () => {
    const game = new Game({ seed: 1, map: testMap })
    expect(game.player.position).toEqual({ x: 2, y: 2 })
  })

  it('emits a tick event after each tick with the new tick number', () => {
    const game = new Game({ seed: 1, map: testMap })
    const ticks: number[] = []
    game.events.on('tick', ({ tick }) => ticks.push(tick))
    game.tick()
    game.tick()
    game.tick()
    expect(ticks).toEqual([1, 2, 3])
  })

  it('supports unsubscribing from events', () => {
    const game = new Game({ seed: 1, map: testMap })
    const ticks: number[] = []
    const unsubscribe = game.events.on('tick', ({ tick }) => ticks.push(tick))
    game.tick()
    unsubscribe()
    game.tick()
    expect(ticks).toEqual([1])
  })

  it('is deterministic: same seed + same commands => same state', () => {
    const script = (game: Game): Array<{ x: number; y: number }> => {
      const positions: Array<{ x: number; y: number }> = []
      game.player.walkTo(9, 12)
      for (let i = 0; i < 5; i++) {
        game.tick()
        positions.push(game.player.position)
      }
      game.player.setRun(true)
      game.player.walkTo(13, 2)
      for (let i = 0; i < 8; i++) {
        game.tick()
        positions.push(game.player.position)
      }
      return positions
    }

    const a = new Game({ seed: 42, map: testMap })
    const b = new Game({ seed: 42, map: testMap })
    expect(script(a)).toEqual(script(b))
    expect(a.tickCount).toBe(b.tickCount)
    expect(a.player.position).toEqual(b.player.position)
    // Rng streams stay in lockstep too.
    expect(a.rng.nextFloat()).toBe(b.rng.nextFloat())
  })
})
