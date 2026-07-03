import { describe, expect, it } from 'vitest'
import { Game } from '../engine'
import { createNewGame } from '../engine/setup/newGame'
import { lumbridgeMap, lumbridgeNodes, lumbridgeNpcs, lumbridgeObjects } from './lumbridge'

/**
 * BFS over walkable tiles from the spawn, orthogonal steps only. Orthogonal
 * connectivity is stricter than the engine's 8-directional movement (every
 * orthogonal step is always a legal move), so anything reachable here is
 * reachable in game.
 */
function reachableFromSpawn(game: Game): Set<number> {
  const { world, spawn } = game
  const key = (x: number, y: number): number => y * world.width + x
  const seen = new Set<number>([key(spawn.x, spawn.y)])
  const queue: Array<{ x: number; y: number }> = [{ x: spawn.x, y: spawn.y }]
  const steps = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ]
  for (let head = 0; head < queue.length; head++) {
    const { x, y } = queue[head]
    for (const { dx, dy } of steps) {
      const nx = x + dx
      const ny = y + dy
      if (!world.isWalkable(nx, ny) || seen.has(key(nx, ny))) continue
      seen.add(key(nx, ny))
      queue.push({ x: nx, y: ny })
    }
  }
  return seen
}

describe('lumbridge map connectivity', () => {
  const game = createNewGame(1)
  const { world } = game
  const key = (x: number, y: number): number => y * world.width + x
  const reachable = reachableFromSpawn(game)

  it('has the expected dimensions and a walkable spawn', () => {
    expect(lumbridgeMap.width).toBe(48)
    expect(lumbridgeMap.height).toBe(40)
    expect(world.isWalkable(game.spawn.x, game.spawn.y)).toBe(true)
  })

  it('every walkable tile is reachable from spawn (no sealed pockets)', () => {
    const unreachable: string[] = []
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        if (world.isWalkable(x, y) && !reachable.has(key(x, y))) {
          unreachable.push(`(${x}, ${y})`)
        }
      }
    }
    expect(unreachable).toEqual([])
  })

  it('every resource node and world object is placed and interactable', () => {
    // Placement tiles hold the node/object; interaction requires at least
    // one reachable tile adjacent (Chebyshev 1) to it.
    const placements = [...lumbridgeNodes, ...lumbridgeObjects]
    expect(world.nodes).toHaveLength(lumbridgeNodes.length)
    expect(world.objects).toHaveLength(lumbridgeObjects.length)
    for (const { defId, x, y } of placements) {
      let adjacentReachable = false
      for (let dy = -1; dy <= 1 && !adjacentReachable; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          if (reachable.has(key(x + dx, y + dy))) {
            adjacentReachable = true
            break
          }
        }
      }
      expect(adjacentReachable, `${defId} at (${x}, ${y}) has no reachable adjacent tile`).toBe(
        true,
      )
    }
  })

  it('every npc spawn tile is reachable from spawn', () => {
    expect(game.npcs).toHaveLength(lumbridgeNpcs.length)
    for (const { defId, x, y } of lumbridgeNpcs) {
      expect(reachable.has(key(x, y)), `${defId} spawn (${x}, ${y}) unreachable`).toBe(true)
    }
  })

  it('the river blocks and the bridge crosses it', () => {
    // Water column x30..33 is blocked away from the bridge...
    for (const y of [10, 15, 25, 35]) {
      for (let x = 30; x <= 33; x++) expect(world.isWalkable(x, y)).toBe(false)
    }
    // ...and the bridge rows y19..20 are walkable bank to bank.
    for (const y of [19, 20]) {
      for (let x = 28; x <= 36; x++) expect(world.isWalkable(x, y)).toBe(true)
    }
  })
})
