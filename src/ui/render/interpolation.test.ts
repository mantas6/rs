import { describe, expect, it } from 'vitest'
import { TICK_MS } from '../../engine'
import { MoverInterpolator } from './interpolation'

describe('MoverInterpolator', () => {
  it('returns the given position for an untracked mover', () => {
    const interp = new MoverInterpolator()
    const key = {}
    expect(interp.mover(key)).toBeUndefined()
    expect(interp.moverPos(key, 4, 7)).toEqual({ x: 4, y: 7 })
  })

  it('tracks previous → current tiles across snapshots', () => {
    const interp = new MoverInterpolator()
    const player = { x: 2, y: 3 }

    interp.snapshotMovers(player, [])
    expect(interp.mover(player)).toEqual({ px: 2, py: 3, cx: 2, cy: 3 })

    player.y = 4
    interp.snapshotMovers(player, [])
    expect(interp.mover(player)).toEqual({ px: 2, py: 3, cx: 2, cy: 4 })
  })

  it('snaps instead of gliding on a teleport (>3 tiles)', () => {
    const interp = new MoverInterpolator()
    const player = { x: 2, y: 2 }
    interp.snapshotMovers(player, [])

    player.x = 20
    player.y = 20
    interp.snapshotMovers(player, [])
    // Both previous and current collapse to the destination — no glide.
    expect(interp.mover(player)).toEqual({ px: 20, py: 20, cx: 20, cy: 20 })
  })

  it('centers a stationary mover on its tile in world space', () => {
    const interp = new MoverInterpolator()
    const player = { x: 6, y: 8 }
    interp.snapshotMovers(player, [])
    // px === cx while still, so the result is exact regardless of tick phase.
    expect(interp.entityWorldPos(player, 6, 8)).toEqual({ x: 6.5, z: 8.5 })
  })

  it('reports the tick phase from the last snapshot time', () => {
    const interp = new MoverInterpolator()
    interp.lastTickAt = 1000
    expect(interp.tickPhase(1000)).toBe(0)
    expect(interp.tickPhase(1000 + TICK_MS / 2)).toBeCloseTo(0.5, 10)
    expect(interp.tickPhase(1000 + TICK_MS)).toBe(1)
    // Beyond a full tick it clamps to 1 (no extrapolation past the target).
    expect(interp.tickPhase(1000 + TICK_MS * 2)).toBe(1)
  })
})
