// The playable UI build delegates to the engine's createNewGame factory
// (src/engine/setup/newGame.ts), so the UI and the headless playthrough
// test share one source of truth for the world and the starting kit.
import { createNewGame, type Game } from '../engine'

/** Build the game the UI plays: the Lumbridge world + starting kit. */
export function createDemoGame(seed: number): Game {
  return createNewGame(seed)
}
