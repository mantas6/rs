// Single source of truth for "a fresh game": the Lumbridge world. The UI
// (createDemoGame) and the headless playthrough test both build their Game
// through this factory, so they can never drift apart. Importing content
// here is fine: content is data-only.
//
// The player starts with an EMPTY inventory: the starter kit (axe,
// pickaxe, net, tinderbox, sword, shield) is stocked for free at the
// Lumbridge General Store counter in the castle courtyard (see
// src/content/shops.ts and player.openShop).
import {
  lumbridgeMap,
  lumbridgeNodes,
  lumbridgeNpcs,
  lumbridgeObjects,
  lumbridgePatches,
} from '../../content/lumbridge'
import { Game } from '../core/game'

/**
 * Build a fresh game on the Lumbridge map. The player spawns empty-handed
 * and gears up at the free general store. Deterministic: the same seed
 * always produces the same game.
 */
export function createNewGame(seed: number): Game {
  return new Game({
    seed,
    map: lumbridgeMap,
    nodes: lumbridgeNodes,
    npcs: lumbridgeNpcs,
    objects: lumbridgeObjects,
    patches: lumbridgePatches,
  })
}
