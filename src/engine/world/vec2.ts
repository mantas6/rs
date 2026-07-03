/** 2D integer tile coordinate. */
export interface Vec2 {
  x: number
  y: number
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y }
}

export function vec2Equals(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y
}

/** Manhattan (4-directional) distance. */
export function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * Chebyshev (8-directional) distance. This is the OSRS notion of distance:
 * two tiles are "adjacent" when their Chebyshev distance is 1.
 */
export function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}
