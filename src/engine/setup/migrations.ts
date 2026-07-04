// Save-format migrations. The engine stays pure: a GameSave is a plain
// JSON-safe object. As the save shape evolves (SAVE_FORMAT_VERSION), old
// saves are upgraded here — stepwise, one version at a time — so a player's
// save is NEVER lost (TOP PRIORITY per AGENTS.md). Adding a new version means
// bumping SAVE_FORMAT_VERSION and adding one entry to MIGRATIONS keyed by the
// from-version.
import { type GameSave, SAVE_FORMAT_VERSION } from '../core/game'

/**
 * A single stepwise migration: takes a save at version N and returns it at
 * version N+1. Operates on a loosely-typed object because the input shape is,
 * by definition, an older format.
 */
type Migration = (save: any) => any

/**
 * Migrations keyed by the version they upgrade FROM. `MIGRATIONS[1]` turns a
 * v1 save into a v2 save, and so on. Keep them pure and total.
 */
const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: farming added persistent patch state. A v1 world had no planted
  // crops, so start with an empty patch array; Game.restore restores patches
  // leniently, leaving every real patch in its default unplanted state.
  1: (save) => ({ ...save, patches: [], version: 2 }),
}

/** True when `value` is a non-null object (not an array). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Upgrade an arbitrary saved object to the current SAVE_FORMAT_VERSION by
 * applying stepwise migrations. Returns the upgraded GameSave, or null when
 * `raw` is malformed (not an object, missing/non-numeric version or seed),
 * its version is newer than this engine understands, or a required migration
 * step is missing. Deep content validation still happens later in
 * Game.restore.
 */
export function migrateSave(raw: unknown): GameSave | null {
  if (!isPlainObject(raw)) return null
  if (typeof raw.version !== 'number' || typeof raw.seed !== 'number') return null
  if (raw.version < 1 || raw.version > SAVE_FORMAT_VERSION) return null

  let save: any = raw
  while (save.version < SAVE_FORMAT_VERSION) {
    const migrate = MIGRATIONS[save.version]
    if (!migrate) return null // gap in the migration chain — refuse to guess
    save = migrate(save)
  }
  return save as GameSave
}
