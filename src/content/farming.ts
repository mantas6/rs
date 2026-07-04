// Farming content: allotment patch definitions and crop (seed) definitions.
// Data-only: plain objects, no logic, no side effects (see AGENTS.md).
//
// Growth-time model: a crop is planted at stage 0 and advances one stage
// every `ticksPerStage` ticks until it reaches `growthStages`, at which point
// it is ready to harvest. Times are kept short (a few stages of a few ticks
// each) so farming is playable in a fast singleplayer clone and in tests,
// while preserving the OSRS-style staged growth flavour. Yields are rolled on
// harvest via the engine Rng in [minYield, maxYield].
import type { FarmPatchDef, SeedDef } from './types'

/** Allotment patches placed in the world (see engine/world/farmPatch.ts). */
export const farmPatchDefs: Record<string, FarmPatchDef> = {
  allotment_patch: {
    id: 'allotment_patch',
    name: 'Allotment patch',
    examine: 'A patch of soil for growing vegetables.',
    blocksMovement: true,
    category: 'allotment',
  },
}

/**
 * Crop definitions keyed by seed item id. An OSRS-plausible early set:
 * potatoes (level 1), onions (level 5) and cabbages (level 7). Growth is
 * quick: potatoes take 6 ticks (3 stages x 2), onions 8 (4 x 2) and cabbages
 * 12 (4 x 3) so they finish within a short headless test run.
 */
export const farmingCrops: Record<string, SeedDef> = {
  potato_seed: {
    seedItemId: 'potato_seed',
    produceItemId: 'potato',
    category: 'allotment',
    levelRequired: 1,
    plantXp: 8,
    harvestXp: 9,
    growthStages: 3,
    ticksPerStage: 2,
    minYield: 1,
    maxYield: 3,
  },
  onion_seed: {
    seedItemId: 'onion_seed',
    produceItemId: 'onion',
    category: 'allotment',
    levelRequired: 5,
    plantXp: 9.5,
    harvestXp: 10.5,
    growthStages: 4,
    ticksPerStage: 2,
    minYield: 1,
    maxYield: 4,
  },
  cabbage_seed: {
    seedItemId: 'cabbage_seed',
    produceItemId: 'cabbage',
    category: 'allotment',
    levelRequired: 7,
    plantXp: 10,
    harvestXp: 11.5,
    growthStages: 4,
    ticksPerStage: 3,
    minYield: 1,
    maxYield: 3,
  },
}
