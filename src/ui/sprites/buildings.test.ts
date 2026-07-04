import { describe, expect, it } from 'vitest'
import { getWorldObjectDef, World, WorldObject } from '../../engine'
import { buildingWallKeys, detectBuildings, detectDoors } from './buildings'

/** Build a World from ASCII rows plus optional bank-booth object placements. */
function makeWorld(rows: string[], objects: Array<[number, number]> = []): World {
  const world = new World({
    id: 'test',
    name: 'Test',
    width: rows[0].length,
    height: rows.length,
    tiles: rows,
  })
  for (const [x, y] of objects) {
    world.addObject(new WorldObject(getWorldObjectDef('bank_booth'), { x, y }))
  }
  return world
}

const key = (world: World, x: number, y: number): number => y * world.width + x

describe('detectBuildings', () => {
  // Two sealed rooms side by side; only the right one holds an object.
  const rows = [
    '###########',
    '#...#.....#',
    '#...#.....#',
    '#...#.....#',
    '###########',
  ]

  it('finds no buildings when no room contains a world object', () => {
    expect(detectBuildings(makeWorld(rows)).length).toBe(0)
  })

  it('detects exactly the room that contains an object, with its footprint', () => {
    const world = makeWorld(rows, [[7, 2]])
    const buildings = detectBuildings(world)

    expect(buildings.length).toBe(1)
    const b = buildings[0]
    // Right room interior x5..9, y1..3 = 15 tiles (the object tile included).
    expect(b.keys.size).toBe(15)
    expect([b.minX, b.maxX, b.minY, b.maxY]).toEqual([5, 9, 1, 3])
    // The object-less left room is never part of a building footprint.
    expect(b.keys.has(key(world, 2, 2))).toBe(false)
    expect(b.keys.has(key(world, 7, 2))).toBe(true)
  })
})

describe('buildingWallKeys', () => {
  const rows = [
    '###########',
    '#...#.....#',
    '#...#.....#',
    '#...#.....#',
    '###########',
  ]

  it('marks only the stone tiles bordering a building interior', () => {
    const world = makeWorld(rows, [[7, 2]])
    const walls = buildingWallKeys(world, detectBuildings(world))

    // The shared divider wall and the right outer wall border the room.
    expect(walls.has(key(world, 4, 2))).toBe(true)
    expect(walls.has(key(world, 10, 2))).toBe(true)
    // North/south walls of the room too.
    expect(walls.has(key(world, 7, 0))).toBe(true)
    expect(walls.has(key(world, 7, 4))).toBe(true)
    // The left (object-less) room's outer wall is NOT a building wall.
    expect(walls.has(key(world, 0, 2))).toBe(false)
  })
})

describe('detectDoors', () => {
  it('finds no doors in a fully sealed room', () => {
    const rows = [
      '#######',
      '#.....#',
      '#.....#',
      '#.....#',
      '#######',
    ]
    const world = makeWorld(rows, [[3, 2]])
    const buildings = detectBuildings(world)
    const walls = buildingWallKeys(world, buildings)
    expect(detectDoors(world, buildings, walls)).toEqual([])
  })

  it('finds a one-wide door flanked by walls, pointing outward', () => {
    // Kitchen-like room (interior x6..8, y2..4) with a door in its west wall at
    // (5,3). A second wall two tiles west (x3) keeps the threshold floored,
    // while the corridor between stays open (as with the town's kitchen).
    const rows = [
      '............',
      '.....#####..',
      '...#.#...#..',
      '...#.....#..',
      '...#.#...#..',
      '.....#####..',
      '............',
      '............',
    ]
    const world = makeWorld(rows, [[7, 3]])
    const buildings = detectBuildings(world)
    const walls = buildingWallKeys(world, buildings)
    const doors = detectDoors(world, buildings, walls)

    expect(doors.length).toBe(1)
    expect(doors[0]).toEqual({ x: 5, y: 3, dx: -1, dy: 0 })
  })
})
