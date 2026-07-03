import type { MapDef } from '../../content/types'
import type { ResourceNode } from './resourceNode'

const WALKABLE = '.'
const BLOCKED = '#'

/**
 * The game world: a tile map with collision built from a data-only MapDef,
 * plus a registry of placed resource nodes. This class is the single source
 * of truth for spatial queries: `isWalkable` accounts for both the base map
 * and blocking nodes (trees/rocks), so pathfinding routes around them.
 */
export class World {
  readonly width: number
  readonly height: number
  /** Row-major walkability flags; index = y * width + x. */
  private readonly walkable: Uint8Array
  private readonly _nodes: ResourceNode[] = []
  /** Node lookup by tile; key = y * width + x. One node per tile. */
  private readonly nodeByTile = new Map<number, ResourceNode>()

  constructor(def: MapDef) {
    if (def.tiles.length !== def.height) {
      throw new Error(
        `Map "${def.id}": expected ${def.height} tile rows, got ${def.tiles.length}`,
      )
    }
    this.width = def.width
    this.height = def.height
    this.walkable = new Uint8Array(def.width * def.height)

    for (let y = 0; y < def.height; y++) {
      const row = def.tiles[y]
      if (row.length !== def.width) {
        throw new Error(
          `Map "${def.id}": row ${y} has length ${row.length}, expected ${def.width}`,
        )
      }
      for (let x = 0; x < def.width; x++) {
        const char = row[x]
        if (char !== WALKABLE && char !== BLOCKED) {
          throw new Error(`Map "${def.id}": unknown tile char "${char}" at (${x}, ${y})`)
        }
        this.walkable[y * def.width + x] = char === WALKABLE ? 1 : 0
      }
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  /**
   * True when (x, y) is inside the map, not blocked by terrain, and not
   * occupied by a blocking resource node (depleted or not).
   */
  isWalkable(x: number, y: number): boolean {
    if (!this.inBounds(x, y) || this.walkable[y * this.width + x] !== 1) return false
    const node = this.nodeByTile.get(y * this.width + x)
    return !node?.blocksMovement
  }

  /** All resource nodes placed in the world. */
  get nodes(): readonly ResourceNode[] {
    return this._nodes
  }

  /** Place a resource node. One node per tile; the tile must be in bounds. */
  addNode(node: ResourceNode): void {
    const { x, y } = node.position
    if (!this.inBounds(x, y)) {
      throw new Error(`addNode: (${x}, ${y}) is out of bounds`)
    }
    const key = y * this.width + x
    if (this.nodeByTile.has(key)) {
      throw new Error(`addNode: tile (${x}, ${y}) already has a node`)
    }
    this.nodeByTile.set(key, node)
    this._nodes.push(node)
  }

  /** The resource node on tile (x, y), or null. */
  nodeAt(x: number, y: number): ResourceNode | null {
    if (!this.inBounds(x, y)) return null
    return this.nodeByTile.get(y * this.width + x) ?? null
  }
}
