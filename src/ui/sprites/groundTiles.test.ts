import { describe, expect, it } from 'vitest'
import { FarmPatch, getFarmPatchDef, World } from '../../engine'
import { isStone } from './groundTiles'

function makeWorld(rows: string[]): World {
  return new World({
    id: 'test',
    name: 'Test',
    width: rows[0].length,
    height: rows.length,
    tiles: rows,
  })
}

describe('ground tile classification', () => {
  it('does not render blocking farm patches as stone walls', () => {
    const world = makeWorld(['...', '...', '...'])
    world.addPatch(new FarmPatch(getFarmPatchDef('allotment_patch'), { x: 1, y: 1 }))

    expect(world.isWalkable(1, 1)).toBe(false)
    expect(isStone(world, 1, 1)).toBe(false)
  })

  it('still renders terrain blockers as stone walls', () => {
    const world = makeWorld(['...', '.#.', '...'])

    expect(isStone(world, 1, 1)).toBe(true)
  })
})
