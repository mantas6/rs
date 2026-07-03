import { describe, expect, it } from 'vitest'
import type { MapDef } from '../../content/types'
import { World } from './tileMap'

function makeDef(overrides: Partial<MapDef> = {}): MapDef {
  return {
    id: 'small',
    name: 'Small',
    width: 4,
    height: 3,
    tiles: ['....', '.##.', '....'],
    ...overrides,
  }
}

describe('World', () => {
  it('exposes width and height', () => {
    const world = new World(makeDef())
    expect(world.width).toBe(4)
    expect(world.height).toBe(3)
  })

  it('reports walkability from tile chars', () => {
    const world = new World(makeDef())
    expect(world.isWalkable(0, 0)).toBe(true)
    expect(world.isWalkable(3, 2)).toBe(true)
    expect(world.isWalkable(1, 1)).toBe(false)
    expect(world.isWalkable(2, 1)).toBe(false)
    expect(world.isWalkable(0, 1)).toBe(true)
  })

  it('returns false for out-of-bounds coordinates', () => {
    const world = new World(makeDef())
    expect(world.isWalkable(-1, 0)).toBe(false)
    expect(world.isWalkable(0, -1)).toBe(false)
    expect(world.isWalkable(4, 0)).toBe(false)
    expect(world.isWalkable(0, 3)).toBe(false)
    expect(world.inBounds(3, 2)).toBe(true)
    expect(world.inBounds(4, 2)).toBe(false)
  })

  it('rejects a map with the wrong number of rows', () => {
    expect(() => new World(makeDef({ tiles: ['....', '....'] }))).toThrow()
  })

  it('rejects a map with a row of the wrong length', () => {
    expect(() => new World(makeDef({ tiles: ['....', '...', '....'] }))).toThrow()
  })

  it('rejects unknown tile characters', () => {
    expect(() => new World(makeDef({ tiles: ['....', '.x#.', '....'] }))).toThrow()
  })
})
