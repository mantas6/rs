import type { World } from './tileMap'
import type { Vec2 } from './vec2'
import { chebyshev } from './vec2'

/**
 * 8-directional movement steps. The fixed order makes BFS tie-breaking
 * deterministic: orthogonal steps are explored before diagonals, so paths
 * prefer straight lines when multiple shortest paths exist.
 */
const STEPS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: -1, dy: 0 }, // west
  { dx: 1, dy: 0 }, // east
  { dx: 0, dy: -1 }, // north
  { dx: 0, dy: 1 }, // south
  { dx: -1, dy: -1 }, // north-west
  { dx: 1, dy: -1 }, // north-east
  { dx: -1, dy: 1 }, // south-west
  { dx: 1, dy: 1 }, // south-east
]

/**
 * True when an entity standing at (x, y) may step by (dx, dy).
 * Diagonal steps are disallowed when either orthogonal neighbor is blocked
 * (OSRS-style corner-cutting prevention).
 */
function canStep(world: World, x: number, y: number, dx: number, dy: number): boolean {
  if (!world.isWalkable(x + dx, y + dy)) return false
  if (dx !== 0 && dy !== 0) {
    if (!world.isWalkable(x + dx, y)) return false
    if (!world.isWalkable(x, y + dy)) return false
  }
  return true
}

/**
 * Uniform-cost BFS from `from` to the first tile satisfying `isGoal`.
 * Returns the path excluding the start tile, [] if `from` already satisfies
 * the goal, or null if no goal tile is reachable.
 */
function bfs(
  world: World,
  from: Vec2,
  isGoal: (x: number, y: number) => boolean,
): Vec2[] | null {
  if (!world.isWalkable(from.x, from.y)) return null
  if (isGoal(from.x, from.y)) return []

  const { width } = world
  const startIdx = from.y * width + from.x
  // cameFrom doubles as the visited set: -1 = unvisited.
  const cameFrom = new Int32Array(world.width * world.height).fill(-1)
  cameFrom[startIdx] = startIdx

  const queue: number[] = [startIdx]
  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const x = idx % width
    const y = (idx - x) / width
    for (const { dx, dy } of STEPS) {
      if (!canStep(world, x, y, dx, dy)) continue
      const nextIdx = (y + dy) * width + (x + dx)
      if (cameFrom[nextIdx] !== -1) continue
      cameFrom[nextIdx] = idx
      if (isGoal(x + dx, y + dy)) {
        return reconstructPath(width, cameFrom, startIdx, nextIdx)
      }
      queue.push(nextIdx)
    }
  }
  return null
}

function reconstructPath(
  width: number,
  cameFrom: Int32Array,
  startIdx: number,
  goalIdx: number,
): Vec2[] {
  const path: Vec2[] = []
  let idx = goalIdx
  while (idx !== startIdx) {
    const x = idx % width
    path.push({ x, y: (idx - x) / width })
    idx = cameFrom[idx]
  }
  return path.reverse()
}

/**
 * Shortest path from `from` to `to` (BFS, uniform cost, 8-directional with
 * corner-cutting prevention). Returns the tile sequence excluding the start
 * tile, [] when already there, or null when `to` is blocked or unreachable.
 */
export function findPath(world: World, from: Vec2, to: Vec2): Vec2[] | null {
  if (!world.isWalkable(to.x, to.y)) return null
  return bfs(world, from, (x, y) => x === to.x && y === to.y)
}

/**
 * Shortest path from `from` to the nearest reachable walkable tile adjacent
 * (Chebyshev distance 1) to `to`. Useful for interacting with blocked tiles
 * such as trees and rocks. Returns [] when already adjacent, or null when no
 * adjacent tile is reachable.
 */
export function findPathAdjacent(world: World, from: Vec2, to: Vec2): Vec2[] | null {
  if (!world.inBounds(to.x, to.y)) return null
  return bfs(world, from, (x, y) => chebyshev({ x, y }, to) === 1)
}

/**
 * Shortest path from `from` to the nearest reachable walkable tile within
 * `range` tiles (Chebyshev) of `to`. Used by ranged combat to close only to
 * weapon range rather than melee adjacency. Returns [] when `from` is
 * already within range, or null when no such tile is reachable. Line of
 * sight is intentionally not modelled (open maps).
 */
export function findPathWithinRange(
  world: World,
  from: Vec2,
  to: Vec2,
  range: number,
): Vec2[] | null {
  if (!world.inBounds(to.x, to.y)) return null
  return bfs(world, from, (x, y) => chebyshev({ x, y }, to) <= range)
}
