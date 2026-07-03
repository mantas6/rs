// Single place where the playable demo world is wired together: map,
// node/object/NPC placements (data from src/content/maps.ts) and the
// player's starting kit. The UI builds exactly one Game from this.
import { demoMap, demoNodes, demoNpcs, demoObjects } from '../content/maps'
import { Game } from '../engine'

/** Items the player starts with (one of each, added in this order). */
export const STARTING_ITEMS: readonly string[] = [
  'bronze_axe',
  'bronze_pickaxe',
  'small_fishing_net',
  'tinderbox',
  'bronze_sword',
  'wooden_shield',
]

/** Build the demo Game: demo world content plus the starting inventory. */
export function createDemoGame(seed: number): Game {
  const game = new Game({
    seed,
    map: demoMap,
    nodes: demoNodes,
    npcs: demoNpcs,
    objects: demoObjects,
  })
  for (const itemId of STARTING_ITEMS) game.player.inventory.add(itemId)
  return game
}
