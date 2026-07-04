// Restoring a saved game. The engine stays pure: a GameSave is a plain
// JSON-safe object (produced by game.serialize()); where it is stored
// (localStorage, a file, ...) is the caller's concern (see src/ui/saveStorage.ts).
import { Game, type GameSave, SAVE_FORMAT_VERSION } from '../core/game'
import { createNewGame } from './newGame'

/**
 * True when `save` looks like a GameSave this engine version can restore
 * (an object with the current format version and a numeric seed). Deep
 * validation happens in Game.restore, which throws on bad content.
 */
export function isCompatibleSave(save: unknown): save is GameSave {
  if (typeof save !== 'object' || save === null) return false
  const candidate = save as { version?: unknown; seed?: unknown }
  return candidate.version === SAVE_FORMAT_VERSION && typeof candidate.seed === 'number'
}

/**
 * Rebuild a Game from a save produced by `game.serialize()`: construct a
 * fresh Lumbridge game (createNewGame) and restore the saved state into it,
 * including the Rng state so the run continues deterministically. Returns
 * null for incompatible versions or corrupt saves — callers should fall
 * back to createNewGame.
 */
export function loadGame(save: unknown): Game | null {
  if (!isCompatibleSave(save)) return null
  try {
    const game = createNewGame(save.seed)
    game.restore(save)
    return game
  } catch {
    return null
  }
}
