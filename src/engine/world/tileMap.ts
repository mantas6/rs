import type { MapDef } from '../../content/types'

const WALKABLE = '.'
const BLOCKED = '#'

/**
 * The game world: a tile map with collision built from a data-only MapDef.
 *
 * Later tasks will add entities/objects placed on tiles; keep this class the
 * single source of truth for spatial queries.
 */
export class World {
  readonly width: number
  readonly height: number
  /** Row-major walkability flags; index = y * width + x. */
  private readonly walkable: Uint8Array

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

  /** True when (x, y) is inside the map and not blocked. */
  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.walkable[y * this.width + x] === 1
  }
}
