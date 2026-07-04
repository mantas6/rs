// localStorage persistence for game saves. This is the ONLY place that
// touches storage: the engine stays pure and only produces/consumes plain
// GameSave objects (game.serialize() / loadGame()).
import type { GameSave } from '../engine'

/** Namespaced localStorage key for the single save slot. */
export const SAVE_STORAGE_KEY = 'runeslop:save'

/**
 * Once the save is cleared (player asked for a new game) further writes are
 * blocked, so the unload-triggered autosave can't resurrect the old save
 * before the page reloads into a fresh game.
 */
let writesDisabled = false

/**
 * Read the stored save, parsed but NOT validated — feed it to the engine's
 * `loadGame`, which rejects incompatible/corrupt saves. Returns null when
 * missing, unparseable, or storage is unavailable (private mode etc.).
 */
export function readStoredSave(): unknown {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

/** Persist a save, silently ignoring storage failures (quota, private mode). */
export function writeStoredSave(save: GameSave): void {
  if (writesDisabled) return
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save))
  } catch {
    // Persistence is best-effort; the game keeps running without it.
  }
}

/**
 * Delete the stored save and block further writes until the page reloads
 * (used by the "New game" button, which reloads right after).
 */
export function clearStoredSave(): void {
  writesDisabled = true
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY)
  } catch {
    // Ignore: nothing to clear or storage unavailable.
  }
}
