// Content type definitions. Content files are data-only: plain objects,
// no logic, no classes, no side effects.

/**
 * Map definition.
 *
 * `tiles` is a row-major grid encoded as one string per row:
 *   '.' = walkable
 *   '#' = blocked
 * `tiles.length` must equal `height` and every row's length must equal
 * `width`. Tile (x, y) is `tiles[y][x]`.
 */
export interface MapDef {
  id: string
  name: string
  /** Map width in tiles. Must match the length of every row in `tiles`. */
  width: number
  /** Map height in tiles. Must match `tiles.length`. */
  height: number
  /** Row-major tile rows; see interface docs for the encoding. */
  tiles: string[]
  /**
   * Optional player spawn tile. Must be walkable. When omitted, the engine
   * falls back to the first walkable tile in row-major order.
   */
  spawn?: { x: number; y: number }
}
