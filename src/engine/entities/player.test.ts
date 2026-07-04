import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { Game } from '../core/game'
import { xpForLevel } from '../systems/skills'
import {
  type PlayerAction,
  RUN_DRAIN_PER_TILE,
  RUN_ENERGY_MAX,
  runEnergyRegenRate,
} from './player'

function makeGame(): Game {
  return new Game({ seed: 7, map: testMap })
}

/** Raw internal run energy (0..RUN_ENERGY_MAX), read via the save snapshot. */
function rawEnergy(game: Game): number {
  return game.player.serialize().runEnergy
}

/** Overwrite the player's run energy (and run flag) via restore, for tests. */
function setEnergy(game: Game, energy: number, running = false): void {
  const save = game.player.serialize()
  save.runEnergy = energy
  save.running = running
  game.player.restore(save)
}

class CountdownAction implements PlayerAction {
  ticksRun = 0

  constructor(private remaining: number) {}

  onTick(): boolean {
    this.ticksRun++
    this.remaining--
    return this.remaining > 0
  }
}

describe('Player movement', () => {
  it('walks 1 tile per tick toward the target', () => {
    const game = makeGame()
    expect(game.player.walkTo(6, 2)).toBe(true)
    expect(game.player.isMoving).toBe(true)

    const expected = [
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
      { x: 6, y: 2 },
    ]
    for (const pos of expected) {
      game.tick()
      expect(game.player.position).toEqual(pos)
    }
    expect(game.player.isMoving).toBe(false)
  })

  it('runs 2 tiles per tick, taking a single step on an odd final tick', () => {
    const game = makeGame()
    game.player.setRun(true)
    expect(game.player.walkTo(7, 2)).toBe(true) // path of 5 tiles

    game.tick()
    expect(game.player.position).toEqual({ x: 4, y: 2 })
    game.tick()
    expect(game.player.position).toEqual({ x: 6, y: 2 })
    game.tick()
    expect(game.player.position).toEqual({ x: 7, y: 2 })
    expect(game.player.isMoving).toBe(false)
  })

  it('replaces the movement queue when walkTo is called mid-path', () => {
    const game = makeGame()
    game.player.walkTo(6, 2)
    game.tick()
    expect(game.player.position).toEqual({ x: 3, y: 2 })

    expect(game.player.walkTo(3, 4)).toBe(true)
    game.tick()
    expect(game.player.position).toEqual({ x: 3, y: 3 })
    game.tick()
    expect(game.player.position).toEqual({ x: 3, y: 4 })
    expect(game.player.isMoving).toBe(false)
  })

  it('returns false for an unreachable target and does not move', () => {
    const game = makeGame()
    // (5, 4) is inside the sealed pocket of testMap.
    expect(game.player.walkTo(5, 4)).toBe(false)
    expect(game.player.isMoving).toBe(false)
    game.tick()
    expect(game.player.position).toEqual({ x: 2, y: 2 })
  })

  it('returns false for a blocked target tile', () => {
    const game = makeGame()
    expect(game.player.walkTo(0, 0)).toBe(false)
    expect(game.player.isMoving).toBe(false)
  })

  it('stop() halts movement immediately', () => {
    const game = makeGame()
    game.player.walkTo(6, 2)
    game.tick()
    game.player.stop()
    expect(game.player.isMoving).toBe(false)
    game.tick()
    expect(game.player.position).toEqual({ x: 3, y: 2 })
  })

  it('emits playerMoved with the new position on each movement tick', () => {
    const game = makeGame()
    const moves: Array<{ x: number; y: number }> = []
    game.events.on('playerMoved', (pos) => moves.push(pos))

    game.player.walkTo(4, 2)
    game.tick()
    game.tick()
    game.tick() // idle tick: no event
    expect(moves).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ])
  })
})

describe('Run energy', () => {
  it('new players start at full energy (100%)', () => {
    const game = makeGame()
    expect(rawEnergy(game)).toBe(RUN_ENERGY_MAX)
    expect(game.player.runEnergy).toBe(100)
  })

  it('drains energy per tile actually stepped while running', () => {
    const game = makeGame()
    game.player.setRun(true)
    expect(game.player.walkTo(7, 2)).toBe(true) // path of 5 tiles

    game.tick() // runs 2 tiles
    expect(rawEnergy(game)).toBe(RUN_ENERGY_MAX - 2 * RUN_DRAIN_PER_TILE)
    game.tick() // runs 2 tiles
    expect(rawEnergy(game)).toBe(RUN_ENERGY_MAX - 4 * RUN_DRAIN_PER_TILE)
    game.tick() // final odd tile: 1 step
    expect(rawEnergy(game)).toBe(RUN_ENERGY_MAX - 5 * RUN_DRAIN_PER_TILE)
    expect(game.player.isMoving).toBe(false)
  })

  it('exposes energy as a whole-percent value for the UI', () => {
    const game = makeGame()
    setEnergy(game, 9500)
    expect(game.player.runEnergy).toBe(95)
  })

  it('regenerates while standing still, scaled by Agility level', () => {
    const game = makeGame()
    setEnergy(game, 5000)
    const rate = runEnergyRegenRate(game.player.skills.getLevel('agility'))
    game.tick() // idle
    expect(rawEnergy(game)).toBe(5000 + rate)
  })

  it('regenerates while walking (not running)', () => {
    const game = makeGame()
    setEnergy(game, 5000, false)
    const rate = runEnergyRegenRate(game.player.skills.getLevel('agility'))
    expect(game.player.walkTo(7, 2)).toBe(true)
    game.tick() // walks one tile
    expect(game.player.position).toEqual({ x: 3, y: 2 })
    expect(rawEnergy(game)).toBe(5000 + rate)
  })

  it('does not regenerate past the maximum', () => {
    const game = makeGame()
    setEnergy(game, RUN_ENERGY_MAX)
    game.tick()
    expect(rawEnergy(game)).toBe(RUN_ENERGY_MAX)
  })

  it('regenerates faster at higher Agility levels', () => {
    const low = makeGame()
    setEnergy(low, 5000)
    low.tick()
    const lowGain = rawEnergy(low) - 5000

    const high = makeGame()
    setEnergy(high, 5000)
    high.player.skills.addXp('agility', xpForLevel(50))
    high.tick()
    const highGain = rawEnergy(high) - 5000

    expect(highGain).toBeGreaterThan(lowGain)
    expect(highGain).toBe(runEnergyRegenRate(50))
  })

  it('auto-reverts to walking when energy hits 0', () => {
    const game = makeGame()
    // Enough for one running tick's step (the gate checks energy > 0 at the
    // start of the tick, so this tick still runs a full 2 tiles).
    setEnergy(game, RUN_DRAIN_PER_TILE, true)
    expect(game.player.running).toBe(true)
    expect(game.player.walkTo(7, 2)).toBe(true)

    game.tick()
    // Energy is spent and the run flag is cleared (OSRS behavior).
    expect(rawEnergy(game)).toBe(0)
    expect(game.player.running).toBe(false)

    // The next tick, drained, only walks a single tile.
    const x = game.player.x
    game.tick()
    expect(game.player.x - x).toBe(1)
  })

  it('cannot run again until energy has recovered, then resumes', () => {
    const game = makeGame()
    setEnergy(game, RUN_DRAIN_PER_TILE, true)
    game.player.walkTo(14, 2)
    game.tick() // drains to 0, reverts to walk
    expect(game.player.running).toBe(false)
    expect(rawEnergy(game)).toBe(0)

    // Re-enabling run at 0 energy still only walks (1 tile/tick)...
    game.player.setRun(true)
    const walkX = game.player.x
    game.tick()
    expect(game.player.x - walkX).toBe(1)

    // ...but once energy has recovered, running resumes (2 tiles/tick).
    setEnergy(game, RUN_ENERGY_MAX, true)
    game.player.walkTo(14, 2)
    const runX = game.player.x
    game.tick()
    expect(game.player.x - runX).toBe(2)
  })

  it('is deterministic: same seed + commands => same energy', () => {
    const run = (): number => {
      const game = makeGame()
      game.player.setRun(true)
      game.player.walkTo(7, 2)
      for (let i = 0; i < 3; i++) game.tick()
      game.player.walkTo(2, 2)
      for (let i = 0; i < 10; i++) game.tick()
      return rawEnergy(game)
    }
    expect(run()).toBe(run())
  })
})

describe('Player actions', () => {
  it('ticks the current action while idle and clears it when done', () => {
    const game = makeGame()
    const action = new CountdownAction(3)
    game.player.setAction(action)

    game.tick()
    game.tick()
    expect(action.ticksRun).toBe(2)
    expect(game.player.action).toBe(action)

    game.tick()
    expect(action.ticksRun).toBe(3)
    expect(game.player.action).toBeNull()

    game.tick()
    expect(action.ticksRun).toBe(3)
  })

  it('does not tick the action while moving', () => {
    const game = makeGame()
    const action = new CountdownAction(99)
    game.player.walkTo(4, 2)
    game.player.setAction(action)
    game.tick()
    expect(action.ticksRun).toBe(0)
    expect(game.player.position).toEqual({ x: 3, y: 2 })
  })

  it('walkTo cancels the current action', () => {
    const game = makeGame()
    const action = new CountdownAction(99)
    game.player.setAction(action)
    expect(game.player.walkTo(4, 2)).toBe(true)
    expect(game.player.action).toBeNull()
  })
})

describe('Player.eat', () => {
  it('consumes the food and heals damaged hitpoints', () => {
    const game = makeGame()
    game.player.inventory.add('shrimps') // heals 3
    game.player.skills.boost('hitpoints', -5) // 10 -> 5
    const eaten: Array<{ itemId: string; healed: number; hpAfter: number }> = []
    game.events.on('itemEaten', (e) => eaten.push(e))

    expect(game.player.eat(0)).toBe(true)
    expect(game.player.skills.getCurrentLevel('hitpoints')).toBe(8)
    expect(game.player.inventory.count('shrimps')).toBe(0)
    expect(eaten).toEqual([{ itemId: 'shrimps', healed: 3, hpAfter: 8 }])
  })

  it('caps healing at the base hitpoints level and still consumes the food', () => {
    const game = makeGame()
    game.player.inventory.add('shrimps')
    game.player.skills.boost('hitpoints', -1) // 10 -> 9
    const eaten: Array<{ itemId: string; healed: number; hpAfter: number }> = []
    game.events.on('itemEaten', (e) => eaten.push(e))

    expect(game.player.eat(0)).toBe(true)
    expect(game.player.skills.getCurrentLevel('hitpoints')).toBe(10)
    expect(eaten).toEqual([{ itemId: 'shrimps', healed: 1, hpAfter: 10 }])
  })

  it('emits actionFailed: not_food for non-food items and keeps them', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    const failures: string[] = []
    game.events.on('actionFailed', (e) => failures.push(e.reason))

    expect(game.player.eat(0)).toBe(false)
    expect(failures).toEqual(['not_food'])
    expect(game.player.inventory.count('tinderbox')).toBe(1)
  })

  it('returns false for an empty slot without emitting', () => {
    const game = makeGame()
    const failures: string[] = []
    game.events.on('actionFailed', (e) => failures.push(e.reason))
    expect(game.player.eat(0)).toBe(false)
    expect(failures).toEqual([])
  })
})

describe('Player.drink', () => {
  it('consumes the beer, leaves an empty glass, boosts/drains stats and heals', () => {
    const game = makeGame()
    game.player.inventory.add('beer')
    game.player.skills.boost('hitpoints', -5) // 10 -> 5
    const drunk: Array<{ itemId: string; emptyItemId: string | null }> = []
    game.events.on('itemDrunk', (e) => drunk.push(e))

    expect(game.player.drink(0)).toBe(true)
    // Beer is gone, an empty beer glass is left in its place.
    expect(game.player.inventory.count('beer')).toBe(0)
    expect(game.player.inventory.count('beer_glass')).toBe(1)
    // +2 strength boost, -3 attack drain (clamped at 0), +1 hitpoints heal.
    expect(game.player.skills.getCurrentLevel('strength')).toBe(3) // base 1 + 2
    expect(game.player.skills.getCurrentLevel('attack')).toBe(0) // base 1 - 3, clamped
    expect(game.player.skills.getCurrentLevel('hitpoints')).toBe(6) // 5 + 1
    expect(drunk).toEqual([{ itemId: 'beer', emptyItemId: 'beer_glass' }])
  })

  it('caps the heal at base hitpoints (drinking at full hp still consumes)', () => {
    const game = makeGame()
    game.player.inventory.add('beer')

    expect(game.player.drink(0)).toBe(true)
    expect(game.player.skills.getCurrentLevel('hitpoints')).toBe(10) // unchanged
    expect(game.player.inventory.count('beer_glass')).toBe(1)
  })

  it('keeps the empty glass in the just-freed slot even when the pack was full', () => {
    const game = makeGame()
    // Fill 27 slots with non-stackables, then the beer takes the 28th slot.
    for (let i = 0; i < 27; i++) game.player.inventory.add('bones')
    game.player.inventory.add('beer')
    expect(game.player.inventory.isFull).toBe(true)
    const beerSlot = game.player.inventory.slots.findIndex((s) => s?.itemId === 'beer')

    // Drinking removes the beer (freeing its slot), so the empty glass fits.
    expect(game.player.drink(beerSlot)).toBe(true)
    expect(game.player.inventory.count('beer')).toBe(0)
    expect(game.player.inventory.count('beer_glass')).toBe(1)
  })

  it('emits actionFailed: not_drinkable for non-drinkable items and keeps them', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    const failures: string[] = []
    game.events.on('actionFailed', (e) => failures.push(e.reason))

    expect(game.player.drink(0)).toBe(false)
    expect(failures).toEqual(['not_drinkable'])
    expect(game.player.inventory.count('tinderbox')).toBe(1)
  })

  it('returns false for an empty slot without emitting', () => {
    const game = makeGame()
    const failures: string[] = []
    const drunk: unknown[] = []
    game.events.on('actionFailed', (e) => failures.push(e.reason))
    game.events.on('itemDrunk', (e) => drunk.push(e))

    expect(game.player.drink(0)).toBe(false)
    expect(failures).toEqual([])
    expect(drunk).toEqual([])
  })
})

describe('Player.drop', () => {
  it('drops the whole stack on the player tile with a despawn timer', () => {
    const game = makeGame()
    game.player.inventory.add('coins', 25)
    const dropped: Array<{ itemId: string; quantity: number; x: number; y: number }> = []
    game.events.on('itemDropped', (e) => dropped.push(e))
    game.tick() // advance so the despawn timer counts from a nonzero tick

    expect(game.player.drop(0)).toBe(true)
    expect(game.player.inventory.count('coins')).toBe(0)
    const onGround = game.groundItems.itemsAt(game.player.x, game.player.y)
    expect(onGround).toHaveLength(1)
    expect(onGround[0].itemId).toBe('coins')
    expect(onGround[0].quantity).toBe(25)
    expect(onGround[0].despawnAtTick).toBe(game.tickCount + 200)
    expect(dropped).toEqual([{ itemId: 'coins', quantity: 25, x: game.player.x, y: game.player.y }])
  })

  it('returns false for an empty slot', () => {
    const game = makeGame()
    expect(game.player.drop(0)).toBe(false)
    expect(game.groundItems.items).toHaveLength(0)
  })
})

describe('Player.bury', () => {
  it('consumes one bone and grants prayer xp, emitting bonesBuried', () => {
    const game = makeGame()
    game.player.inventory.add('bones', 2)
    const buried: Array<{ itemId: string; xp: number }> = []
    game.events.on('bonesBuried', (e) => buried.push(e))

    expect(game.player.bury(0)).toBe(true)
    expect(game.player.inventory.count('bones')).toBe(1)
    expect(game.player.skills.getXp('prayer')).toBe(4.5)
    expect(buried).toEqual([{ itemId: 'bones', xp: 4.5 }])
  })

  it('emits actionFailed: not_buryable for non-buryable items and keeps them', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    const failures: string[] = []
    game.events.on('actionFailed', (e) => failures.push(e.reason))

    expect(game.player.bury(0)).toBe(false)
    expect(failures).toEqual(['not_buryable'])
    expect(game.player.inventory.count('tinderbox')).toBe(1)
    expect(game.player.skills.getXp('prayer')).toBe(0)
  })

  it('returns false for an empty slot without emitting', () => {
    const game = makeGame()
    const failures: string[] = []
    const buried: unknown[] = []
    game.events.on('actionFailed', (e) => failures.push(e.reason))
    game.events.on('bonesBuried', (e) => buried.push(e))

    expect(game.player.bury(0)).toBe(false)
    expect(failures).toEqual([])
    expect(buried).toEqual([])
  })
})

describe('PlayerAction UI descriptors (kind + targetPosition)', () => {
  it('exposes the gather skill and node tile while gathering', () => {
    const game = new Game({
      seed: 7,
      map: testMap,
      nodes: [{ defId: 'tree', x: 6, y: 2 }],
    })
    game.player.inventory.add('bronze_axe')
    const node = game.world.nodeAt(6, 2)
    expect(node).not.toBeNull()
    expect(game.player.gather(node!)).toBe(true)
    expect(game.player.action?.kind).toBe('woodcutting')
    expect(game.player.action?.targetPosition).toEqual({ x: 6, y: 2 })
  })

  it('exposes combat with the live NPC position while attacking', () => {
    const game = new Game({
      seed: 7,
      map: testMap,
      npcs: [{ defId: 'chicken', x: 4, y: 2 }],
    })
    expect(game.player.attack(game.npcs[0])).toBe(true)
    expect(game.player.action?.kind).toBe('combat')
    expect(game.player.action?.targetPosition).toEqual(game.npcs[0].position)
  })
})
