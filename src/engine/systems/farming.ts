import type { Game } from '../core/game'
import type { Player, PlayerAction, PlayerActionKind } from '../entities/player'
import { type FarmPatch, getFarmingCrop, isFarmingSeed } from '../world/farmPatch'
import { chebyshev, type Vec2 } from '../world/vec2'

/** Why a plant or harvest attempt failed to start or was interrupted. */
export type FarmingFailReason =
  | 'level_too_low'
  | 'missing_seed'
  | 'patch_occupied'
  | 'patch_empty'
  | 'not_ready'
  | 'inventory_full'
  | 'invalid_source'

// Farming events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when a seed is planted (the seed is already consumed). */
    cropPlanted: { patchId: string; seedId: string; xp: number }
    /** Emitted when a crop advances a growth stage (tick-driven). */
    cropGrew: { patchId: string; seedId: string; stage: number }
    /** Emitted when a grown crop is harvested (produce + xp already granted). */
    cropHarvested: { patchId: string; produceItemId: string; quantity: number; xp: number }
  }
}

/**
 * Validate that `player` may plant `seedItemId` in `patch` right now.
 * Returns the failure reason, or null when planting may proceed. Uses the
 * CURRENT (boostable) Farming level for the requirement, like OSRS.
 */
export function validatePlant(
  player: Player,
  patch: FarmPatch,
  seedItemId: string,
): FarmingFailReason | null {
  if (!isFarmingSeed(seedItemId)) return 'invalid_source'
  const crop = getFarmingCrop(seedItemId)
  if (crop.category !== patch.def.category) return 'invalid_source'
  if (patch.isPlanted) return 'patch_occupied'
  if (player.skills.getCurrentLevel('farming') < crop.levelRequired) return 'level_too_low'
  if (!player.inventory.has(seedItemId, 1)) return 'missing_seed'
  return null
}

/**
 * Validate that `player` may harvest `patch` right now. Returns the failure
 * reason, or null when harvesting may proceed.
 */
export function validateHarvest(player: Player, patch: FarmPatch): FarmingFailReason | null {
  if (!patch.isPlanted) return 'patch_empty'
  if (!patch.isGrown()) return 'not_ready'
  if (player.inventory.isFull) return 'inventory_full'
  return null
}

/**
 * Plant a seed in a farm patch (walk-then-act, like gathering).
 *
 * Started via `player.plant(seedItemId, patch)`, which validates, queues a
 * walk to an adjacent tile and sets this action. Player.update walks first
 * and only ticks the action once movement completes, so "walk then plant"
 * falls out of the movement/action interaction. The action performs a single
 * plant then ends: consumes one seed, sets the crop, grants plantXp and emits
 * `cropPlanted`.
 */
export class PlantAction implements PlayerAction {
  constructor(
    private readonly patch: FarmPatch,
    private readonly seedItemId: string,
  ) {}

  get kind(): PlayerActionKind {
    return 'farming'
  }

  get targetPosition(): Readonly<Vec2> {
    return this.patch.position
  }

  onTick(game: Game): boolean {
    const { player, events } = game
    // Player.update only ticks actions while idle; a non-adjacent player here
    // means the walk was interrupted (stop()) — end silently.
    if (chebyshev(player.position, this.patch.position) !== 1) return false

    const reason = validatePlant(player, this.patch, this.seedItemId)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    const crop = getFarmingCrop(this.seedItemId)
    player.inventory.remove(this.seedItemId, 1)
    this.patch.plant(this.seedItemId)
    player.skills.addXp('farming', crop.plantXp)
    events.emit('cropPlanted', {
      patchId: this.patch.def.id,
      seedId: this.seedItemId,
      xp: crop.plantXp,
    })
    return false
  }
}

/**
 * Harvest a grown crop from a farm patch (walk-then-act, like planting).
 *
 * Rolls a yield in [minYield, maxYield] via `game.rng`, then adds that many
 * produce items, granting harvestXp per produce actually collected. If the
 * inventory fills mid-harvest, the collected produce is kept, `actionFailed:
 * inventory_full` is emitted, and the patch is only reset when every rolled
 * produce fit. Emits `cropHarvested` with the quantity collected.
 */
export class HarvestAction implements PlayerAction {
  constructor(private readonly patch: FarmPatch) {}

  get kind(): PlayerActionKind {
    return 'farming'
  }

  get targetPosition(): Readonly<Vec2> {
    return this.patch.position
  }

  onTick(game: Game): boolean {
    const { player, events, rng } = game
    if (chebyshev(player.position, this.patch.position) !== 1) return false

    const reason = validateHarvest(player, this.patch)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    const seedId = this.patch.plantedSeedId as string
    const crop = getFarmingCrop(seedId)
    // Roll the yield first (deterministic), then add produce one at a time so
    // a full inventory mid-harvest is handled gracefully.
    const yieldAmount = rng.nextInt(crop.minYield, crop.maxYield)
    let collected = 0
    for (let i = 0; i < yieldAmount; i++) {
      if (player.inventory.add(crop.produceItemId, 1) === 0) break
      collected++
    }
    if (collected > 0) {
      player.skills.addXp('farming', crop.harvestXp * collected)
      events.emit('cropHarvested', {
        patchId: this.patch.def.id,
        produceItemId: crop.produceItemId,
        quantity: collected,
        xp: crop.harvestXp * collected,
      })
    }

    if (collected < yieldAmount) {
      // Ran out of inventory space before collecting the whole crop: leave
      // the patch grown so the player can bank/drop and finish it later.
      events.emit('actionFailed', { reason: 'inventory_full' })
      return false
    }
    this.patch.harvestReset()
    return false
  }
}
