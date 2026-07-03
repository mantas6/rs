// Type-only imports from the engine (erased at runtime; content stays
// data-only). Placement types are defined next to GameConfig.
import type { NodePlacement, NpcPlacement, ObjectPlacement } from '../engine/core/game'
import type { MapDef } from './types'

/**
 * Small 16x16 map used by engine tests.
 *
 * '.' = walkable, '#' = blocked. Notable features:
 * - Outer wall all the way around.
 * - A sealed 4-tile pocket inside the box at (5..6, 4..5) — walkable tiles
 *   that are unreachable from anywhere else (for unreachable-path tests).
 * - A free-standing horizontal wall on row 8.
 */
export const testMap: MapDef = {
  id: 'testMap',
  name: 'Test Map',
  width: 16,
  height: 16,
  spawn: { x: 2, y: 2 },
  tiles: [
    '################',
    '#..............#',
    '#..............#',
    '#...####.......#',
    '#...#..#.......#',
    '#...#..#.......#',
    '#...####.......#',
    '#..............#',
    '#......######..#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '################',
  ],
}

/**
 * 32x24 demo world used by the playable UI build.
 *
 * '.' = walkable grass, '#' = blocked. Notable features:
 * - Outer wall all the way around.
 * - A wall segment on row 3 (x 12..20): the back wall of the "bank",
 *   with the bank booth and cooking range placed in front of it.
 * - A pond (blocked tiles) at x 24..29, y 4..8 with a net fishing spot
 *   on the shore tile just west of it.
 */
export const demoMap: MapDef = {
  id: 'demoMap',
  name: 'Demo World',
  width: 32,
  height: 24,
  spawn: { x: 16, y: 12 },
  tiles: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#...........#########..........#',
    '#.......................######.#',
    '#.......................######.#',
    '#.......................######.#',
    '#.......................######.#',
    '#.......................######.#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '################################',
  ],
}

/** Resource nodes placed in the demo world (woods west, rocks southeast). */
export const demoNodes: NodePlacement[] = [
  { defId: 'tree', x: 4, y: 14 },
  { defId: 'tree', x: 7, y: 16 },
  { defId: 'tree', x: 3, y: 18 },
  { defId: 'tree', x: 9, y: 13 },
  { defId: 'oak_tree', x: 5, y: 11 },
  { defId: 'copper_rock', x: 24, y: 17 },
  { defId: 'tin_rock', x: 26, y: 18 },
  { defId: 'iron_rock', x: 25, y: 15 },
  { defId: 'fishing_spot_net', x: 23, y: 6 },
]

/** World objects placed in the demo world (bank + range along row 4). */
export const demoObjects: ObjectPlacement[] = [
  { defId: 'bank_booth', x: 14, y: 4 },
  { defId: 'cooking_range', x: 18, y: 4 },
]

/** NPC spawns in the demo world. */
export const demoNpcs: NpcPlacement[] = [
  { defId: 'goblin', x: 20, y: 13 },
  { defId: 'goblin', x: 22, y: 11 },
  { defId: 'cow', x: 10, y: 8 },
  { defId: 'chicken', x: 8, y: 6 },
  { defId: 'chicken', x: 10, y: 5 },
  { defId: 'giant_rat', x: 27, y: 10 },
]
