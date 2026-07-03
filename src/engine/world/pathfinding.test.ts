import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { findPath, findPathAdjacent } from './pathfinding'
import { World } from './tileMap'
import { chebyshev, type Vec2 } from './vec2'

function makeWorld(rows: string[]): World {
  return new World({
    id: 'test',
    name: 'Test',
    width: rows[0].length,
    height: rows.length,
    tiles: rows,
  })
}

/** Asserts every step is walkable, contiguous and never cuts a corner. */
function assertValidPath(world: World, from: Vec2, path: Vec2[]): void {
  let prev = from
  for (const step of path) {
    expect(world.isWalkable(step.x, step.y)).toBe(true)
    expect(chebyshev(prev, step)).toBe(1)
    const dx = step.x - prev.x
    const dy = step.y - prev.y
    if (dx !== 0 && dy !== 0) {
      expect(world.isWalkable(prev.x + dx, prev.y)).toBe(true)
      expect(world.isWalkable(prev.x, prev.y + dy)).toBe(true)
    }
    prev = step
  }
}

describe('findPath', () => {
  it('walks a straight line, excluding the start tile', () => {
    const world = makeWorld(['.....', '.....', '.....'])
    const path = findPath(world, { x: 0, y: 0 }, { x: 3, y: 0 })
    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
  })

  it('returns an empty path when already at the target', () => {
    const world = makeWorld(['..', '..'])
    expect(findPath(world, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([])
  })

  it('uses diagonals for shortest paths', () => {
    const world = makeWorld(['....', '....', '....', '....'])
    const path = findPath(world, { x: 0, y: 0 }, { x: 3, y: 3 })
    expect(path).not.toBeNull()
    expect(path!).toHaveLength(3)
    expect(path![2]).toEqual({ x: 3, y: 3 })
    assertValidPath(world, { x: 0, y: 0 }, path!)
  })

  it('routes around walls', () => {
    const world = makeWorld(['.....', '.###.', '.....'])
    const from = { x: 2, y: 0 }
    const path = findPath(world, from, { x: 2, y: 2 })
    expect(path).not.toBeNull()
    // Corner-cutting prevention forces the long way around: 6 steps.
    expect(path!).toHaveLength(6)
    expect(path![5]).toEqual({ x: 2, y: 2 })
    assertValidPath(world, from, path!)
  })

  it('does not cut a corner past a single blocked orthogonal neighbor', () => {
    // Diagonal (0,0)->(1,1) is illegal because (0,1) is blocked; must go via (1,0).
    const world = makeWorld(['..', '#.'])
    const path = findPath(world, { x: 0, y: 0 }, { x: 1, y: 1 })
    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  it('returns null when both corner tiles are blocked', () => {
    const world = makeWorld(['.#', '#.'])
    expect(findPath(world, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull()
  })

  it('returns null when the target tile is blocked', () => {
    const world = makeWorld(['...', '.#.', '...'])
    expect(findPath(world, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull()
  })

  it('returns null when the target is out of bounds', () => {
    const world = makeWorld(['..', '..'])
    expect(findPath(world, { x: 0, y: 0 }, { x: 5, y: 0 })).toBeNull()
  })

  it('returns null for an unreachable walled-off tile', () => {
    // (5, 4) is inside the sealed box pocket of testMap.
    const world = new World(testMap)
    expect(world.isWalkable(5, 4)).toBe(true)
    expect(findPath(world, { x: 2, y: 2 }, { x: 5, y: 4 })).toBeNull()
  })
})

describe('findPathAdjacent', () => {
  it('paths to the nearest walkable tile adjacent to a blocked target', () => {
    const world = makeWorld(['.....', '.....', '..#..', '.....', '.....'])
    const path = findPathAdjacent(world, { x: 0, y: 0 }, { x: 2, y: 2 })
    expect(path).not.toBeNull()
    expect(path!).toHaveLength(1)
    expect(chebyshev(path![0], { x: 2, y: 2 })).toBe(1)
    assertValidPath(world, { x: 0, y: 0 }, path!)
  })

  it('returns an empty path when already adjacent to the target', () => {
    const world = makeWorld(['...', '.#.', '...'])
    expect(findPathAdjacent(world, { x: 0, y: 1 }, { x: 1, y: 1 })).toEqual([])
  })

  it('stops next to a walkable target instead of on it', () => {
    const world = makeWorld(['.....'])
    const path = findPathAdjacent(world, { x: 0, y: 0 }, { x: 4, y: 0 })
    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
  })

  it('returns null when no adjacent tile is reachable', () => {
    const world = makeWorld(['.....', '.###.', '.#.#.', '.###.'])
    expect(findPathAdjacent(world, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull()
  })
})
