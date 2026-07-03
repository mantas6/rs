import { resourceNodes } from '../../content/resourceNodes'
import type { ResourceNodeDef } from '../../content/types'
import type { Vec2 } from './vec2'

/**
 * Resource node lookup for engine code. Content stays data-only; this is
 * the engine's typed gateway into the node record (mirrors itemRegistry).
 */
export function getResourceNodeDef(id: string): ResourceNodeDef {
  const def = resourceNodes[id]
  if (!def) throw new Error(`Unknown resource node id: ${id}`)
  return def
}

/**
 * A resource node placed in the world (tree, rock, fishing spot).
 *
 * Depletion state lives here; the Game respawns depleted nodes when the
 * tick counter reaches `respawnAtTick`. A depleted tree/rock keeps blocking
 * movement (OSRS stumps block); fishing spots never block.
 */
export class ResourceNode {
  private _depleted = false
  private _respawnAtTick = 0

  constructor(
    readonly def: ResourceNodeDef,
    readonly position: Readonly<Vec2>,
  ) {}

  get depleted(): boolean {
    return this._depleted
  }

  /** Tick at which the node respawns. Only meaningful while depleted. */
  get respawnAtTick(): number {
    return this._respawnAtTick
  }

  /** Blocking depends only on the def: stumps/empty rocks still block. */
  get blocksMovement(): boolean {
    return this.def.blocksMovement
  }

  /** Mark the node depleted until `respawnAtTick`. */
  deplete(respawnAtTick: number): void {
    this._depleted = true
    this._respawnAtTick = respawnAtTick
  }

  /** Restore the node so it can be gathered again. */
  respawn(): void {
    this._depleted = false
    this._respawnAtTick = 0
  }
}
