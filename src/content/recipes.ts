// Processing-skill definitions (cooking recipes, firemaking logs).
// Data-only: plain objects, no logic.
import type { CookingRecipeDef, FiremakingDef } from './types'

/**
 * Cooking recipes, keyed by raw item id. Burn chance interpolates linearly
 * from 0.5 at `levelRequired` down to 0 at `burnStopLevel` (cooking.ts).
 */
export const cookingRecipes: Record<string, CookingRecipeDef> = {
  raw_shrimps: {
    rawItemId: 'raw_shrimps',
    cookedItemId: 'shrimps',
    burntItemId: 'burnt_shrimps',
    levelRequired: 1,
    xp: 30,
    burnStopLevel: 34,
  },
  raw_trout: {
    rawItemId: 'raw_trout',
    cookedItemId: 'trout',
    burntItemId: 'burnt_trout',
    levelRequired: 15,
    xp: 70,
    burnStopLevel: 49,
  },
  raw_beef: {
    rawItemId: 'raw_beef',
    cookedItemId: 'cooked_beef',
    burntItemId: 'burnt_beef',
    levelRequired: 1,
    xp: 30,
    burnStopLevel: 34,
  },
  raw_chicken: {
    rawItemId: 'raw_chicken',
    cookedItemId: 'cooked_chicken',
    burntItemId: 'burnt_chicken',
    levelRequired: 1,
    xp: 30,
    burnStopLevel: 34,
  },
}

/** Firemaking definitions, keyed by logs item id. */
export const firemakingDefs: Record<string, FiremakingDef> = {
  logs: {
    logsItemId: 'logs',
    levelRequired: 1,
    xp: 40,
    burnTicks: 100,
  },
  oak_logs: {
    logsItemId: 'oak_logs',
    levelRequired: 15,
    xp: 60,
    burnTicks: 150,
  },
}
