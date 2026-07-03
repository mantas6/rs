import { worldObjects } from '../../content/objects'
import type { WorldObjectDef } from '../../content/types'
import type { Vec2 } from './vec2'

/**
 * World object lookup for engine code. Content stays data-only; this is
 * the engine's typed gateway into the object record (mirrors itemRegistry).
 */
export function getWorldObjectDef(id: string): WorldObjectDef {
  const def = worldObjects[id]
  if (!def) throw new Error(`Unknown world object id: ${id}`)
  return def
}

/**
 * A static object placed in the world (bank booth, cooking range). Like
 * resource nodes, blocking objects make their tile unwalkable, so players
 * interact from an adjacent tile (walk-then-act). Objects have no state of
 * their own — behavior comes from the def flags (`bank`, `cookingSource`).
 */
export class WorldObject {
  constructor(
    readonly def: WorldObjectDef,
    readonly position: Readonly<Vec2>,
  ) {}

  get blocksMovement(): boolean {
    return this.def.blocksMovement
  }
}
