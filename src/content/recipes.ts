// Processing-skill definitions (cooking recipes, firemaking logs, smelting).
// Data-only: plain objects, no logic.
import type { CookingRecipeDef, FiremakingDef, SmeltingRecipeDef } from './types'

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

/**
 * Smelting recipes (Smithing), keyed by the bar item id produced. Bronze is
 * made from one Copper and one Tin ore and always succeeds; iron needs a
 * single Iron ore but only smelts successfully half the time (a failed
 * attempt still consumes the ore, like OSRS). See smithing.ts.
 */
export const smeltingRecipes: Record<string, SmeltingRecipeDef> = {
  bronze_bar: {
    barItemId: 'bronze_bar',
    inputs: [
      { itemId: 'copper_ore', quantity: 1 },
      { itemId: 'tin_ore', quantity: 1 },
    ],
    levelRequired: 1,
    xp: 6.2,
    successChance: 1,
  },
  iron_bar: {
    barItemId: 'iron_bar',
    inputs: [{ itemId: 'iron_ore', quantity: 1 }],
    levelRequired: 15,
    xp: 12.5,
    successChance: 0.5,
  },
}
