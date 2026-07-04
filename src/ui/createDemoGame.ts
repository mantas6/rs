// The playable UI build delegates to the engine's createNewGame factory
// (src/engine/setup/newGame.ts), so the UI and the headless playthrough
// test share one source of truth for the world and the starting kit.
//
// Autoload: when localStorage holds a valid save it is restored (the
// ?seed= parameter is then ignored — the save carries its own seed and Rng
// state); otherwise a fresh game is created. Incompatible or corrupt saves
// are rejected by the engine's loadGame and fall back to a new game.
import { createNewGame, type Game, loadGame } from '../engine'
import { readStoredSave } from './saveStorage'

/** Build the game the UI plays: the stored save, or a fresh Lumbridge world. */
export function createDemoGame(seed: number): Game {
  return loadGame(readStoredSave()) ?? createNewGame(seed)
}
