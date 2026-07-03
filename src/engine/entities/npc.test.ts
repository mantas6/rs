import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { npcs } from '../../content/npcs'
import type { DropTable } from '../../content/types'
import { Game } from '../core/game'
import { Rng } from '../core/rng'
import { chebyshev } from '../world/vec2'
import { DEFAULT_WANDER_RADIUS, getNpcDef, rollDrops } from './npc'

describe('getNpcDef', () => {
  it('returns content defs and throws on unknown ids', () => {
    expect(getNpcDef('goblin')).toBe(npcs.goblin)
    expect(() => getNpcDef('dragon')).toThrow(/Unknown npc id/)
  })
})

describe('rollDrops', () => {
  it('always drops every `always` entry', () => {
    const table: DropTable = {
      always: [
        { itemId: 'bones', quantity: 1 },
        { itemId: 'cowhide', quantity: 1 },
      ],
      entries: [],
    }
    expect(rollDrops(new Rng(1), table)).toEqual([
      { itemId: 'bones', quantity: 1 },
      { itemId: 'cowhide', quantity: 1 },
    ])
  })

  it('a null entry drops nothing from the weighted table', () => {
    const table: DropTable = {
      always: [{ itemId: 'bones', quantity: 1 }],
      entries: [{ itemId: null, quantity: 1, weight: 1 }],
    }
    for (let seed = 0; seed < 20; seed++) {
      expect(rollDrops(new Rng(seed), table)).toEqual([{ itemId: 'bones', quantity: 1 }])
    }
  })

  it('rolls range quantities within the inclusive bounds', () => {
    const table: DropTable = {
      entries: [{ itemId: 'coins', quantity: [3, 7], weight: 1 }],
    }
    for (let seed = 0; seed < 50; seed++) {
      const drops = rollDrops(new Rng(seed), table)
      expect(drops).toHaveLength(1)
      expect(drops[0].quantity).toBeGreaterThanOrEqual(3)
      expect(drops[0].quantity).toBeLessThanOrEqual(7)
    }
  })

  it('weighted entries are all reachable across seeds', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 200; seed++) {
      for (const drop of rollDrops(new Rng(seed), npcs.goblin.drops)) seen.add(drop.itemId)
    }
    expect(seen).toContain('bones')
    expect(seen).toContain('coins')
    expect(seen).toContain('bronze_sword')
  })
})

describe('npc wandering', () => {
  it('wanders but stays within the wander radius of spawn', () => {
    const spawn = { x: 8, y: 11 }
    const game = new Game({ seed: 3, map: testMap, npcs: [{ defId: 'cow', ...spawn }] })
    const cow = game.npcs[0]
    const visited = new Set<string>()

    // Keep the player away so the (passive) cow just wanders.
    for (let i = 0; i < 200; i++) {
      game.tick()
      expect(chebyshev(cow.position, spawn)).toBeLessThanOrEqual(DEFAULT_WANDER_RADIUS)
      visited.add(`${cow.x},${cow.y}`)
    }
    expect(visited.size).toBeGreaterThan(1) // it did move
  })

  it('passive npcs never target the player on their own', () => {
    const game = new Game({ seed: 5, map: testMap, npcs: [{ defId: 'cow', x: 3, y: 2 }] })
    for (let i = 0; i < 50; i++) game.tick()
    expect(game.npcs[0].target).toBeNull()
  })
})

describe('npc placement and movement rules', () => {
  it('npcs do not block walking', () => {
    const game = new Game({ seed: 1, map: testMap, npcs: [{ defId: 'cow', x: 3, y: 2 }] })
    expect(game.world.isWalkable(3, 2)).toBe(true)
    expect(game.player.walkTo(3, 2)).toBe(true)
  })

  it('rejects spawns on blocked tiles', () => {
    expect(
      () => new Game({ seed: 1, map: testMap, npcs: [{ defId: 'cow', x: 0, y: 0 }] }),
    ).toThrow(/not walkable/)
  })
})
