// Single source of truth for "a fresh game": the Lumbridge world plus the
// player's starting kit. The UI (createDemoGame) and the headless
// playthrough test both build their Game through this factory, so they can
// never drift apart. Importing content here is fine: content is data-only.
import {
  lumbridgeMap,
  lumbridgeNodes,
  lumbridgeNpcs,
  lumbridgeObjects,
} from '../../content/lumbridge'
import { Game } from '../core/game'

/** Items a new player starts with (one of each, added in this order). */
export const STARTING_ITEMS: readonly string[] = [
  'bronze_axe',
  'bronze_pickaxe',
  'small_fishing_net',
  'tinderbox',
  'bronze_sword',
  'wooden_shield',
]

/**
 * Build a fresh game on the Lumbridge map with the standard starting kit.
 * Deterministic: the same seed always produces the same game.
 */
export function createNewGame(seed: number): Game {
  const game = new Game({
    seed,
    map: lumbridgeMap,
    nodes: lumbridgeNodes,
    npcs: lumbridgeNpcs,
    objects: lumbridgeObjects,
  })
  for (const itemId of STARTING_ITEMS) game.player.inventory.add(itemId)
  return game
}
