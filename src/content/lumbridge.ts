// The Lumbridge-inspired playable world: map + node/object/NPC placements.
// Data-only: plain objects, no logic (see AGENTS.md content rules).
//
// Type-only imports from the engine (erased at runtime; content stays
// data-only). Placement types are defined next to GameConfig.
import type { NodePlacement, NpcPlacement, ObjectPlacement } from '../engine/core/game'
import type { MapDef } from './types'

/**
 * 48x40 Lumbridge-style world.
 *
 * '.' = walkable, '#' = blocked. Layout (x grows east, y grows south):
 *
 * - Castle: walled courtyard at x6..20, y4..14 with the spawn (13, 10),
 *   a bank booth and a general-store counter inside, and a gate in the
 *   south wall at x12..14.
 * - Kitchen house at x22..27, y10..14 with a cooking range inside and a
 *   door in the west wall at (22, 12).
 * - Chicken coop at x23..27, y3..6 with a gap in the south fence at (25, 6).
 * - River: 4 tiles of water at x30..33 running the full map height,
 *   crossed by a 2-tile-wide bridge on rows y19..20.
 * - Cow field east of the river at x36..45, y4..12 with a fence-gap
 *   entrance at (36, 8).
 * - Forest west/southwest (regular + oak trees placed as nodes).
 * - Mine in the southeast (copper/tin/iron rocks placed as nodes).
 * - Net fishing spots on the west river bank at (29, 15) and (29, 24).
 * - Swampy south-west: giant rats roam there.
 */
export const lumbridgeMap: MapDef = {
  id: 'lumbridge',
  name: 'Lumbridge',
  width: 48,
  height: 40,
  spawn: { x: 13, y: 10 },
  tiles: [
    '################################################',
    '#.............................####.............#',
    '#.............................####.............#',
    '#......................#####..####.............#',
    '#.....###############..#...#..####..##########.#',
    '#.....#.............#..#...#..####..#........#.#',
    '#.....#.............#..##.##..####..#........#.#',
    '#.....#.............#.........####..#........#.#',
    '#.....#.............#.........####...........#.#',
    '#.....#.............#.........####..#........#.#',
    '#.....#.............#.######..####..#........#.#',
    '#.....#.............#.#....#..####..#........#.#',
    '#.....#.............#......#..####..##########.#',
    '#.....#.............#.#....#..####.............#',
    '#.....######...######.######..####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#..............................................#',
    '#..............................................#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '#.............................####.............#',
    '################################################',
  ],
}

/**
 * Resource nodes: forest west/southwest (6 trees + 3 oaks), mine in the
 * southeast (2 copper, 2 tin, 2 iron), and 2 net fishing spots on the
 * west bank of the river.
 */
export const lumbridgeNodes: NodePlacement[] = [
  // Forest (west/southwest of the castle).
  { defId: 'tree', x: 3, y: 18 },
  { defId: 'tree', x: 6, y: 20 },
  { defId: 'tree', x: 4, y: 23 },
  { defId: 'tree', x: 8, y: 25 },
  { defId: 'tree', x: 3, y: 28 },
  { defId: 'tree', x: 7, y: 30 },
  { defId: 'oak_tree', x: 9, y: 22 },
  { defId: 'oak_tree', x: 2, y: 25 },
  { defId: 'oak_tree', x: 5, y: 31 },
  // Mine (southeast, across the river).
  { defId: 'copper_rock', x: 39, y: 32 },
  { defId: 'copper_rock', x: 41, y: 33 },
  { defId: 'tin_rock', x: 43, y: 32 },
  { defId: 'tin_rock', x: 40, y: 35 },
  { defId: 'iron_rock', x: 38, y: 34 },
  { defId: 'iron_rock', x: 42, y: 36 },
  // Net fishing spots on the west river bank.
  { defId: 'fishing_spot_net', x: 29, y: 15 },
  { defId: 'fishing_spot_net', x: 29, y: 24 },
]

/**
 * World objects: bank booth and general-store counter in the courtyard,
 * range in the kitchen.
 */
export const lumbridgeObjects: ObjectPlacement[] = [
  { defId: 'bank_booth', x: 10, y: 6 },
  { defId: 'shop_counter', x: 16, y: 6 },
  { defId: 'cooking_range', x: 25, y: 11 },
]

/**
 * NPC spawns: chickens by the coop, cows in the fenced field, goblins
 * across the bridge, giant rats in the swampy south-west.
 */
export const lumbridgeNpcs: NpcPlacement[] = [
  { defId: 'chicken', x: 24, y: 4 },
  { defId: 'chicken', x: 26, y: 5 },
  { defId: 'chicken', x: 24, y: 7 },
  { defId: 'cow', x: 39, y: 6 },
  { defId: 'cow', x: 42, y: 8 },
  { defId: 'cow', x: 40, y: 10 },
  { defId: 'goblin', x: 37, y: 18 },
  { defId: 'goblin', x: 39, y: 21 },
  { defId: 'goblin', x: 36, y: 23 },
  { defId: 'giant_rat', x: 14, y: 35 },
  { defId: 'giant_rat', x: 18, y: 33 },
]
