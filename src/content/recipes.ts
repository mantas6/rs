// Processing-skill definitions (cooking recipes, firemaking logs, smelting).
// Data-only: plain objects, no logic.
import type {
  CookingRecipeDef,
  CraftingRecipeDef,
  FiremakingDef,
  SmeltingRecipeDef,
  SmithingRecipeDef,
  TanningRecipeDef,
} from './types'

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
 * attempt still consumes the ore, like OSRS); steel needs a single Steel ore
 * and always succeeds once you reach the higher level. See smithing.ts.
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
  steel_bar: {
    barItemId: 'steel_bar',
    inputs: [{ itemId: 'steel_ore', quantity: 1 }],
    levelRequired: 20,
    xp: 17.5,
    successChance: 1,
  },
}

/**
 * Smithing (forging) recipes, keyed by the product item id. Bronze bars are
 * hammered into finished bronze equipment at an anvil (see smithing.ts).
 * Forging always succeeds; each attempt consumes `barsRequired` bars and
 * grants 12.5 smithing xp per bar used (matching OSRS bronze). Levels and
 * bar counts follow OSRS for each bronze item.
 */
export const smithingRecipes: Record<string, SmithingRecipeDef> = {
  bronze_axe: {
    productItemId: 'bronze_axe',
    barItemId: 'bronze_bar',
    barsRequired: 1,
    levelRequired: 1,
    xp: 12.5,
  },
  bronze_sword: {
    productItemId: 'bronze_sword',
    barItemId: 'bronze_bar',
    barsRequired: 1,
    levelRequired: 4,
    xp: 12.5,
  },
  bronze_scimitar: {
    productItemId: 'bronze_scimitar',
    barItemId: 'bronze_bar',
    barsRequired: 2,
    levelRequired: 5,
    xp: 25,
  },
  bronze_full_helm: {
    productItemId: 'bronze_full_helm',
    barItemId: 'bronze_bar',
    barsRequired: 2,
    levelRequired: 7,
    xp: 25,
  },
  bronze_platelegs: {
    productItemId: 'bronze_platelegs',
    barItemId: 'bronze_bar',
    barsRequired: 3,
    levelRequired: 16,
    xp: 37.5,
  },
  bronze_platebody: {
    productItemId: 'bronze_platebody',
    barItemId: 'bronze_bar',
    barsRequired: 5,
    levelRequired: 18,
    xp: 62.5,
  },
}

/**
 * Tanning recipes (Crafting), keyed by the raw hide item id. Tanning turns a
 * hide into leather at a tannery; it grants no xp and never fails, matching
 * OSRS (the Crafting xp comes from sewing the leather afterwards). See
 * crafting.ts.
 */
export const tanningRecipes: Record<string, TanningRecipeDef> = {
  cowhide: {
    hideItemId: 'cowhide',
    leatherItemId: 'leather',
  },
}

/**
 * Crafting (sewing) recipes, keyed by the product item id. Leather is
 * stitched into equipment with a needle (kept) and thread (consumed). Levels
 * and xp follow OSRS soft-leather crafting. See crafting.ts.
 */
export const craftingRecipes: Record<string, CraftingRecipeDef> = {
  leather_gloves: {
    productItemId: 'leather_gloves',
    leatherItemId: 'leather',
    leatherRequired: 1,
    threadRequired: 1,
    levelRequired: 1,
    xp: 13.8,
  },
  leather_boots: {
    productItemId: 'leather_boots',
    leatherItemId: 'leather',
    leatherRequired: 1,
    threadRequired: 1,
    levelRequired: 7,
    xp: 16.25,
  },
  leather_body: {
    productItemId: 'leather_body',
    leatherItemId: 'leather',
    leatherRequired: 1,
    threadRequired: 1,
    levelRequired: 14,
    xp: 25,
  },
  leather_chaps: {
    productItemId: 'leather_chaps',
    leatherItemId: 'leather',
    leatherRequired: 1,
    threadRequired: 1,
    levelRequired: 18,
    xp: 27,
  },
}
