import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { resourceNodes } from '../../content/resourceNodes'
import { Game, type NodePlacement } from '../core/game'
import { findPath } from '../world/pathfinding'
import type { ResourceNode } from '../world/resourceNode'
import type { ActionFailReason } from './gathering'
import { gatherSuccessChance } from './gathering'

// testMap spawn is (2, 2). Tiles used below are walkable in the base map.
const TREE = { defId: 'tree', x: 6, y: 2 }
const OAK = { defId: 'oak_tree', x: 6, y: 2 }
const FISHING_SPOT = { defId: 'fishing_spot_net', x: 6, y: 10 }

function makeGame(nodes: NodePlacement[], seed = 42): Game {
  return new Game({ seed, map: testMap, nodes })
}

function nodeAt(game: Game, x: number, y: number): ResourceNode {
  const node = game.world.nodeAt(x, y)
  if (!node) throw new Error(`no node at (${x}, ${y})`)
  return node
}

function collectFailures(game: Game): ActionFailReason[] {
  const reasons: ActionFailReason[] = []
  game.events.on('actionFailed', ({ reason }) => reasons.push(reason))
  return reasons
}

/** Tick until `done` returns true (throws after `max` ticks). */
function tickUntil(game: Game, done: () => boolean, max = 200): void {
  for (let i = 0; i < max; i++) {
    game.tick()
    if (done()) return
  }
  throw new Error(`condition not met within ${max} ticks`)
}

describe('gatherSuccessChance', () => {
  const def = resourceNodes.tree

  it('interpolates linearly between chanceLow and chanceHigh', () => {
    expect(gatherSuccessChance(def, 1, 1)).toBeCloseTo(def.chanceLow)
    expect(gatherSuccessChance(def, 99, 1)).toBeCloseTo(def.chanceHigh)
    expect(gatherSuccessChance(def, 50, 1)).toBeCloseTo(
      (def.chanceLow + def.chanceHigh) / 2,
    )
  })

  it('adds a bonus per tool tier above 1 and clamps to 1', () => {
    expect(gatherSuccessChance(def, 1, 2)).toBeCloseTo(def.chanceLow + 0.05)
    expect(gatherSuccessChance(def, 99, 99)).toBe(1)
  })
})

describe('gathering: pathing and start', () => {
  it('walks adjacent to a distant tree, then starts chopping', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('bronze_axe')
    const tree = nodeAt(game, TREE.x, TREE.y)

    expect(game.player.gather(tree)).toBe(true)
    expect(game.player.isMoving).toBe(true)
    expect(game.player.action).not.toBeNull()

    game.tick()
    game.tick()
    game.tick()
    expect(game.player.position).toEqual({ x: 5, y: 2 }) // adjacent
    expect(game.player.inventory.count('logs')).toBe(0) // not chopped while walking

    tickUntil(game, () => game.player.inventory.count('logs') > 0)
    expect(game.player.inventory.count('logs')).toBe(1)
  })

  it('returns false without an event when no adjacent tile is reachable', () => {
    // (5, 4) is inside the sealed pocket of testMap: walkable, unreachable.
    const game = makeGame([{ defId: 'tree', x: 5, y: 4 }])
    game.player.inventory.add('bronze_axe')
    const failures = collectFailures(game)

    expect(game.player.gather(nodeAt(game, 5, 4))).toBe(false)
    expect(game.player.action).toBeNull()
    expect(failures).toEqual([])
  })
})

describe('gathering: validation', () => {
  it('emits level_too_low for an oak tree at woodcutting 1', () => {
    const game = makeGame([OAK])
    game.player.inventory.add('bronze_axe')
    const failures = collectFailures(game)

    expect(game.player.gather(nodeAt(game, OAK.x, OAK.y))).toBe(false)
    expect(failures).toEqual(['level_too_low'])
    expect(game.player.action).toBeNull()
  })

  it('emits missing_tool without an axe', () => {
    const game = makeGame([TREE])
    const failures = collectFailures(game)

    expect(game.player.gather(nodeAt(game, TREE.x, TREE.y))).toBe(false)
    expect(failures).toEqual(['missing_tool'])
  })

  it('emits missing_tool when the only axe requires a higher level', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('iron_axe') // requires woodcutting 5
    const failures = collectFailures(game)

    expect(game.player.gather(nodeAt(game, TREE.x, TREE.y))).toBe(false)
    expect(failures).toEqual(['missing_tool'])
  })

  it('accepts a tool equipped in the weapon slot', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('bronze_axe')
    expect(game.player.equip('bronze_axe')).toBe(true)
    expect(game.player.inventory.count('bronze_axe')).toBe(0)

    expect(game.player.gather(nodeAt(game, TREE.x, TREE.y))).toBe(true)
    tickUntil(game, () => game.player.inventory.count('logs') > 0)
  })

  it('emits inventory_full when starting with a full inventory', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('bronze_axe')
    game.player.inventory.add('logs', 27)
    const failures = collectFailures(game)

    expect(game.player.gather(nodeAt(game, TREE.x, TREE.y))).toBe(false)
    expect(failures).toEqual(['inventory_full'])
  })

  it('emits node_depleted for a depleted node', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('bronze_axe')
    const tree = nodeAt(game, TREE.x, TREE.y)
    tree.deplete(999)
    const failures = collectFailures(game)

    expect(game.player.gather(tree)).toBe(false)
    expect(failures).toEqual(['node_depleted'])
  })
})

describe('gathering: success, xp and events', () => {
  it('grants the item, xp and emits resourceGathered', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('bronze_axe')
    const gathered: Array<{ nodeId: string; itemId: string; xp: number }> = []
    game.events.on('resourceGathered', (e) => gathered.push(e))

    game.player.gather(nodeAt(game, TREE.x, TREE.y))
    tickUntil(game, () => game.player.inventory.count('logs') > 0)

    expect(gathered).toEqual([{ nodeId: 'tree', itemId: 'logs', xp: 25 }])
    expect(game.player.skills.getXp('woodcutting')).toBe(25)
  })

  it('emits gatherSwing on every swing, including unsuccessful ones', () => {
    const game = makeGame([FISHING_SPOT])
    game.player.inventory.add('small_fishing_net')
    const swings: string[] = []
    let catches = 0
    game.events.on('gatherSwing', ({ nodeId, skill }) => {
      expect(skill).toBe('fishing')
      swings.push(nodeId)
    })
    game.events.on('resourceGathered', () => catches++)

    game.player.gather(nodeAt(game, FISHING_SPOT.x, FISHING_SPOT.y))
    for (let i = 0; i < 30; i++) game.tick()

    // One swing per gather tick — more swings than actual catches, proving
    // the sound-driving event fires even when no fish is caught.
    expect(swings.length).toBeGreaterThan(catches)
    expect(swings.every((id) => id === 'fishing_spot_net')).toBe(true)
  })
})

describe('gathering: depletion and respawn', () => {
  it('regular tree depletes after the first log and the action ends', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('bronze_axe')
    const tree = nodeAt(game, TREE.x, TREE.y)
    const depletions: Array<{ nodeId: string; respawnAtTick: number }> = []
    game.events.on('nodeDepleted', ({ nodeId, respawnAtTick }) =>
      depletions.push({ nodeId, respawnAtTick }),
    )

    game.player.gather(tree)
    tickUntil(game, () => tree.depleted)

    expect(game.player.inventory.count('logs')).toBe(1)
    expect(game.player.action).toBeNull()
    expect(depletions).toEqual([
      { nodeId: 'tree', respawnAtTick: game.tickCount + resourceNodes.tree.respawnTicks },
    ])
  })

  it('respawns after respawnTicks and can be chopped again', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('bronze_axe')
    const tree = nodeAt(game, TREE.x, TREE.y)
    const respawns: string[] = []
    game.events.on('nodeRespawned', ({ nodeId }) => respawns.push(nodeId))

    game.player.gather(tree)
    tickUntil(game, () => tree.depleted)

    // Still depleted (and still blocking) on the tick before respawn.
    while (game.tickCount < tree.respawnAtTick - 1) game.tick()
    expect(tree.depleted).toBe(true)
    expect(game.world.isWalkable(TREE.x, TREE.y)).toBe(false)

    game.tick() // tickCount reaches respawnAtTick
    expect(tree.depleted).toBe(false)
    expect(respawns).toEqual(['tree'])

    expect(game.player.gather(tree)).toBe(true)
    tickUntil(game, () => game.player.inventory.count('logs') === 2)
  })

  it('fishing spots never deplete', () => {
    const game = makeGame([FISHING_SPOT])
    game.player.inventory.add('small_fishing_net')
    const spot = nodeAt(game, FISHING_SPOT.x, FISHING_SPOT.y)

    game.player.gather(spot)
    tickUntil(game, () => game.player.inventory.count('raw_shrimps') >= 3)
    expect(spot.depleted).toBe(false)
    expect(game.player.action).not.toBeNull()
    expect(game.player.skills.getXp('fishing')).toBe(
      game.player.inventory.count('raw_shrimps') * 10,
    )
  })
})

describe('gathering: blocking', () => {
  it('trees block walking and pathfinding routes around them', () => {
    const game = makeGame([{ defId: 'tree', x: 3, y: 2 }])
    expect(game.world.isWalkable(3, 2)).toBe(false)
    expect(game.player.walkTo(3, 2)).toBe(false)

    const path = findPath(game.world, game.player.position, { x: 5, y: 2 })
    expect(path).not.toBeNull()
    expect(path!.some((p) => p.x === 3 && p.y === 2)).toBe(false)
  })

  it('fishing spots do not block walking', () => {
    const game = makeGame([FISHING_SPOT])
    expect(game.world.isWalkable(FISHING_SPOT.x, FISHING_SPOT.y)).toBe(true)
    expect(game.player.walkTo(FISHING_SPOT.x, FISHING_SPOT.y)).toBe(true)
  })
})

describe('gathering: interruption', () => {
  it('stops with actionFailed when the inventory fills mid-action', () => {
    const game = makeGame([FISHING_SPOT])
    game.player.inventory.add('small_fishing_net')
    game.player.inventory.add('logs', 26) // 27 used, 1 free
    const failures = collectFailures(game)

    game.player.gather(nodeAt(game, FISHING_SPOT.x, FISHING_SPOT.y))
    tickUntil(game, () => game.player.action === null)

    expect(game.player.inventory.isFull).toBe(true)
    expect(game.player.inventory.count('raw_shrimps')).toBe(1)
    expect(failures).toEqual(['inventory_full'])
  })

  it('walkTo cancels gathering', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('bronze_axe')
    game.player.gather(nodeAt(game, TREE.x, TREE.y))
    expect(game.player.walkTo(2, 3)).toBe(true)
    expect(game.player.action).toBeNull()
  })

  it('ends silently when stop() interrupts the walk to the node', () => {
    const game = makeGame([TREE])
    game.player.inventory.add('bronze_axe')
    const failures = collectFailures(game)

    game.player.gather(nodeAt(game, TREE.x, TREE.y))
    game.tick() // one step: (3, 2), not adjacent yet
    game.player.stop()
    game.tick() // idle: action sees non-adjacency and ends

    expect(game.player.action).toBeNull()
    expect(failures).toEqual([])
    expect(game.player.inventory.count('logs')).toBe(0)
  })
})

describe('gathering: determinism', () => {
  it('same seed + same commands produce identical inventory and xp', () => {
    const run = (): { shrimps: number; xp: number } => {
      const game = makeGame([FISHING_SPOT], 1234)
      game.player.inventory.add('small_fishing_net')
      game.player.gather(nodeAt(game, FISHING_SPOT.x, FISHING_SPOT.y))
      for (let i = 0; i < 100; i++) game.tick()
      return {
        shrimps: game.player.inventory.count('raw_shrimps'),
        xp: game.player.skills.getXp('fishing'),
      }
    }

    const a = run()
    const b = run()
    expect(a).toEqual(b)
    expect(a.shrimps).toBeGreaterThan(0)
  })
})
