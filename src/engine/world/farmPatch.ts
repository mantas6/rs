import { farmingCrops, farmPatchDefs } from '../../content/farming'
import type { FarmPatchDef, SeedDef } from '../../content/types'
import type { Vec2 } from './vec2'

/**
 * Farm patch lookup for engine code. Content stays data-only; this is the
 * engine's typed gateway into the patch record (mirrors getResourceNodeDef).
 */
export function getFarmPatchDef(id: string): FarmPatchDef {
  const def = farmPatchDefs[id]
  if (!def) throw new Error(`Unknown farm patch id: ${id}`)
  return def
}

/**
 * Crop (seed) lookup for engine code, keyed by seed item id (mirrors
 * getFarmPatchDef). Throws for a seed with no crop definition.
 */
export function getFarmingCrop(seedItemId: string): SeedDef {
  const crop = farmingCrops[seedItemId]
  if (!crop) throw new Error(`Unknown farming crop for seed: ${seedItemId}`)
  return crop
}

/** True when `seedItemId` has a crop definition (a plantable seed). */
export function isFarmingSeed(seedItemId: string): boolean {
  return seedItemId in farmingCrops
}

/** JSON-safe snapshot of a patch's crop state (see FarmPatch.serialize). */
export interface FarmPatchSave {
  /** Planted seed item id, or null when the patch is empty. */
  seedId: string | null
  /** Current growth stage (0..crop.growthStages). */
  stage: number
  /** Ticks accumulated toward advancing to the next stage. */
  ticksIntoStage: number
}

/**
 * A farm patch placed in the world (allotment). Unlike stateless world
 * objects, a patch carries PERSISTENT crop state — a planted crop keeps
 * growing tick by tick and must survive save/load — so it serializes like a
 * resource node. The Game advances every patch once per tick via `grow()`.
 *
 * Growth is a pure deterministic function of the tick counter: the crop
 * spends `ticksPerStage` ticks in each of `growthStages` stages, then is
 * ready to harvest (`isGrown`). Patches block movement (like trees/booths),
 * so the player plants and harvests from an adjacent tile.
 */
export class FarmPatch {
  private _seedId: string | null = null
  private _stage = 0
  private _ticksIntoStage = 0

  constructor(
    readonly def: FarmPatchDef,
    readonly position: Readonly<Vec2>,
  ) {}

  /** Blocking depends only on the def (empty patches still block). */
  get blocksMovement(): boolean {
    return this.def.blocksMovement
  }

  /** Planted seed item id, or null when the patch is empty. */
  get plantedSeedId(): string | null {
    return this._seedId
  }

  get isPlanted(): boolean {
    return this._seedId !== null
  }

  /** Current growth stage (0 = just planted). */
  get stage(): number {
    return this._stage
  }

  /** Ticks accumulated toward the next stage. */
  get ticksIntoStage(): number {
    return this._ticksIntoStage
  }

  /** Plant a seed, resetting growth. Caller validates level/seed first. */
  plant(seedItemId: string): void {
    getFarmingCrop(seedItemId) // fail fast on a seed with no crop
    this._seedId = seedItemId
    this._stage = 0
    this._ticksIntoStage = 0
  }

  /** True when a planted crop has reached its final growth stage. */
  isGrown(): boolean {
    if (this._seedId === null) return false
    return this._stage >= getFarmingCrop(this._seedId).growthStages
  }

  /**
   * Advance the crop by one tick. Returns true when a growth stage was just
   * crossed (so the Game can emit `cropGrew`). A no-op on an empty or
   * fully-grown patch. Called by Game.tick — deterministic, tick-driven.
   */
  grow(): boolean {
    if (this._seedId === null) return false
    const crop = getFarmingCrop(this._seedId)
    if (this._stage >= crop.growthStages) return false
    this._ticksIntoStage++
    if (this._ticksIntoStage >= crop.ticksPerStage) {
      this._ticksIntoStage = 0
      this._stage++
      return true
    }
    return false
  }

  /** Clear the patch back to empty (after harvesting). */
  harvestReset(): void {
    this._seedId = null
    this._stage = 0
    this._ticksIntoStage = 0
  }

  /** JSON-safe snapshot of the crop state, for save/load. */
  serialize(): FarmPatchSave {
    return { seedId: this._seedId, stage: this._stage, ticksIntoStage: this._ticksIntoStage }
  }

  /**
   * Restore a snapshot from `serialize()`. A null seed restores an empty
   * patch. Throws on an unknown seed id or invalid growth numbers so a
   * corrupt save is rejected (callers treat that as incompatible).
   */
  restore(save: FarmPatchSave): void {
    if (save.seedId === null) {
      this._seedId = null
      this._stage = 0
      this._ticksIntoStage = 0
      return
    }
    getFarmingCrop(save.seedId) // fail fast on unknown seed ids
    if (!Number.isInteger(save.stage) || save.stage < 0) {
      throw new Error(`FarmPatch.restore: invalid stage ${save.stage}`)
    }
    if (!Number.isInteger(save.ticksIntoStage) || save.ticksIntoStage < 0) {
      throw new Error(`FarmPatch.restore: invalid ticksIntoStage ${save.ticksIntoStage}`)
    }
    this._seedId = save.seedId
    this._stage = save.stage
    this._ticksIntoStage = save.ticksIntoStage
  }
}
