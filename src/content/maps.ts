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

// The playable world lives in lumbridge.ts (map + placements).
