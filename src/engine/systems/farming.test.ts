import { describe, expect, it } from 'vitest'
import { farmingCrops } from '../../content/farming'
import { testMap } from '../../content/maps'
import { Game, type PatchPlacement } from '../core/game'
import type { FarmPatch } from '../world/farmPatch'
import type { ActionFailReason } from './gathering'

// testMap spawn is (2, 2). (4, 2) is walkable and reachable, and a blocking
// patch there is worked from an adjacent tile (e.g. (3, 2)).
const PATCH: PatchPlacement = { defId: 'allotment_patch', x: 4, y: 2 }

function makeGame(seed = 42): Game {
  return new Game({ seed, map: testMap, patches: [PATCH] })
}

function patchAt(game: Game, x: number, y: number): FarmPatch {
  const patch = game.world.patchAt(x, y)
  if (!patch) throw new Error(`no patch at (${x}, ${y})`)
  return patch
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

/** Plant a seed and tick until it is actually in the ground. */
function plantAndSettle(game: Game, seedId: string, patch: FarmPatch): void {
  expect(game.player.plant(seedId, patch)).toBe(true)
  tickUntil(game, () => patch.isPlanted)
}

describe('farming: planting', () => {
  it('walks adjacent, consumes a seed, grants plantXp and emits cropPlanted', () => {
    const game = makeGame()
    game.player.inventory.add('potato_seed', 2)
    const patch = patchAt(game, PATCH.x, PATCH.y)
    const planted: Array<{ patchId: string; seedId: string; xp: number }> = []
    game.events.on('cropPlanted', (e) => planted.push(e))

    expect(game.player.plant('potato_seed', patch)).toBe(true)
    expect(game.player.isMoving).toBe(true) // walks first
    tickUntil(game, () => patch.isPlanted)

    expect(patch.plantedSeedId).toBe('potato_seed')
    expect(game.player.inventory.count('potato_seed')).toBe(1) // one consumed
    expect(game.player.skills.getXp('farming')).toBe(farmingCrops.potato_seed.plantXp)
    expect(planted).toEqual([
      { patchId: 'allotment_patch', seedId: 'potato_seed', xp: farmingCrops.potato_seed.plantXp },
    ])
  })
})

describe('farming: growth', () => {
  it('advances one stage every ticksPerStage ticks, deterministically', () => {
    const game = makeGame()
    game.player.inventory.add('potato_seed')
    const patch = patchAt(game, PATCH.x, PATCH.y)
    const crop = farmingCrops.potato_seed
    plantAndSettle(game, 'potato_seed', patch)

    expect(patch.stage).toBe(0)
    expect(patch.isGrown()).toBe(false)

    // The planting tick does not grow the crop (growth runs before the player
    // action in Game.tick), so exactly growthStages*ticksPerStage more ticks
    // are needed to mature.
    const total = crop.growthStages * crop.ticksPerStage
    for (let i = 0; i < total; i++) {
      expect(patch.isGrown()).toBe(false)
      game.tick()
    }
    expect(patch.isGrown()).toBe(true)
    expect(patch.stage).toBe(crop.growthStages)
  })

  it('emits cropGrew on each stage advance', () => {
    const game = makeGame()
    game.player.inventory.add('potato_seed')
    const patch = patchAt(game, PATCH.x, PATCH.y)
    const stages: number[] = []
    game.events.on('cropGrew', ({ stage }) => stages.push(stage))
    plantAndSettle(game, 'potato_seed', patch)

    tickUntil(game, () => patch.isGrown())
    expect(stages).toEqual([1, 2, 3]) // potato has 3 growth stages
  })
})

describe('farming: harvesting', () => {
  it('yields produce in [min, max], grants harvestXp per produce and resets the patch', () => {
    const game = makeGame()
    game.player.inventory.add('potato_seed')
    const patch = patchAt(game, PATCH.x, PATCH.y)
    const crop = farmingCrops.potato_seed
    const harvested: Array<{ produceItemId: string; quantity: number; xp: number }> = []
    game.events.on('cropHarvested', ({ produceItemId, quantity, xp }) =>
      harvested.push({ produceItemId, quantity, xp }),
    )

    plantAndSettle(game, 'potato_seed', patch)
    const plantXp = game.player.skills.getXp('farming')
    tickUntil(game, () => patch.isGrown())

    expect(game.player.harvest(patch)).toBe(true)
    tickUntil(game, () => !patch.isPlanted)

    const potatoes = game.player.inventory.count('potato')
    expect(potatoes).toBeGreaterThanOrEqual(crop.minYield)
    expect(potatoes).toBeLessThanOrEqual(crop.maxYield)
    expect(game.player.skills.getXp('farming')).toBe(plantXp + crop.harvestXp * potatoes)
    expect(harvested).toEqual([
      { produceItemId: 'potato', quantity: potatoes, xp: crop.harvestXp * potatoes },
    ])
    // Patch is empty again and can be replanted.
    expect(patch.isPlanted).toBe(false)
    expect(patch.isGrown()).toBe(false)
  })

  it('cannot harvest until the crop is fully grown', () => {
    const game = makeGame()
    game.player.inventory.add('potato_seed')
    const patch = patchAt(game, PATCH.x, PATCH.y)
    const failures = collectFailures(game)
    plantAndSettle(game, 'potato_seed', patch)

    expect(game.player.harvest(patch)).toBe(false)
    expect(failures).toEqual(['not_ready'])
  })
})

describe('farming: validation', () => {
  it('emits level_too_low for an onion at farming 1', () => {
    const game = makeGame()
    game.player.inventory.add('onion_seed')
    const patch = patchAt(game, PATCH.x, PATCH.y)
    const failures = collectFailures(game)

    expect(game.player.plant('onion_seed', patch)).toBe(false)
    expect(failures).toEqual(['level_too_low'])
    expect(patch.isPlanted).toBe(false)
  })

  it('emits missing_seed without the seed', () => {
    const game = makeGame()
    const patch = patchAt(game, PATCH.x, PATCH.y)
    const failures = collectFailures(game)

    expect(game.player.plant('potato_seed', patch)).toBe(false)
    expect(failures).toEqual(['missing_seed'])
  })

  it('emits patch_occupied when the patch already has a crop', () => {
    const game = makeGame()
    game.player.inventory.add('potato_seed', 2)
    const patch = patchAt(game, PATCH.x, PATCH.y)
    plantAndSettle(game, 'potato_seed', patch)
    const failures = collectFailures(game)

    expect(game.player.plant('potato_seed', patch)).toBe(false)
    expect(failures).toEqual(['patch_occupied'])
  })

  it('emits patch_empty when harvesting an empty patch', () => {
    const game = makeGame()
    const patch = patchAt(game, PATCH.x, PATCH.y)
    const failures = collectFailures(game)

    expect(game.player.harvest(patch)).toBe(false)
    expect(failures).toEqual(['patch_empty'])
  })

  it('emits inventory_full when harvesting with no inventory space', () => {
    const game = makeGame()
    game.player.inventory.add('potato_seed')
    const patch = patchAt(game, PATCH.x, PATCH.y)
    plantAndSettle(game, 'potato_seed', patch)
    tickUntil(game, () => patch.isGrown())
    // Fill every slot so no produce fits.
    game.player.inventory.add('logs', game.player.inventory.freeSlots)
    expect(game.player.inventory.isFull).toBe(true)
    const failures = collectFailures(game)

    expect(game.player.harvest(patch)).toBe(false)
    expect(failures).toEqual(['inventory_full'])
    expect(patch.isGrown()).toBe(true) // crop is left intact
  })

  it('allows onions once Farming level is high enough', () => {
    const game = makeGame()
    game.player.skills.addXp('farming', 1000) // well past level 5 and 7
    game.player.inventory.add('onion_seed')
    const patch = patchAt(game, PATCH.x, PATCH.y)

    expect(game.player.plant('onion_seed', patch)).toBe(true)
    tickUntil(game, () => patch.isPlanted)
    expect(patch.plantedSeedId).toBe('onion_seed')
  })
})

describe('farming: determinism', () => {
  it('same seed + same commands produce the same harvest yield', () => {
    const run = (): number => {
      const game = makeGame(1234)
      game.player.inventory.add('potato_seed')
      const patch = patchAt(game, PATCH.x, PATCH.y)
      plantAndSettle(game, 'potato_seed', patch)
      tickUntil(game, () => patch.isGrown())
      game.player.harvest(patch)
      tickUntil(game, () => !patch.isPlanted)
      return game.player.inventory.count('potato')
    }

    const a = run()
    const b = run()
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(farmingCrops.potato_seed.minYield)
  })
})
