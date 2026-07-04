// Restoring a saved game. The engine stays pure: a GameSave is a plain
// JSON-safe object (produced by game.serialize()); where it is stored
// (localStorage, a file, ...) is the caller's concern (see src/ui/saveStorage.ts).
import type { Game, GameSave } from '../core/game'
import { migrateSave } from './migrations'
import { createNewGame } from './newGame'

/**
 * True when `save` can be brought to the current save format (i.e. it is a
 * well-formed save of this or an older, migratable version). Older saves are
 * upgraded transparently by `migrateSave`, so v1 saves still count as
 * compatible. Deep content validation happens in Game.restore, which throws
 * on bad content.
 */
export function isCompatibleSave(save: unknown): save is GameSave {
  return migrateSave(save) !== null
}

/**
 * Rebuild a Game from a save produced by `game.serialize()`: migrate the save
 * up to the current format, construct a fresh Lumbridge game (createNewGame)
 * and restore the (migrated) state into it, including the Rng state so the
 * run continues deterministically. Returns null for saves this engine cannot
 * migrate or for corrupt saves — callers should fall back to createNewGame.
 */
export function loadGame(save: unknown): Game | null {
  const migrated = migrateSave(save)
  if (migrated === null) return null
  try {
    const game = createNewGame(migrated.seed)
    game.restore(migrated)
    return game
  } catch {
    return null
  }
}
