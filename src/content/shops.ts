// Shop definitions. Data-only: plain objects, no logic.
//
// The Lumbridge general store hands out the starter kit for free: the
// player spawns with an empty inventory and gears up here (see
// src/engine/setup/newGame.ts).
import type { ShopDef } from './types'

export const shops: Record<string, ShopDef> = {
  lumbridge_general_store: {
    id: 'lumbridge_general_store',
    name: 'Lumbridge General Store',
    // General store: buys any item back at 40% of its base value.
    sellRate: 0.4,
    stock: [
      { itemId: 'bronze_axe', price: 0 },
      { itemId: 'bronze_pickaxe', price: 0 },
      { itemId: 'small_fishing_net', price: 0 },
      { itemId: 'tinderbox', price: 0 },
      { itemId: 'bronze_sword', price: 0 },
      { itemId: 'wooden_shield', price: 0 },
      { itemId: 'needle', price: 0 },
      { itemId: 'thread', price: 0 },
      { itemId: 'knife', price: 0 },
      { itemId: 'potato_seed', price: 0 },
      { itemId: 'onion_seed', price: 0 },
      { itemId: 'cabbage_seed', price: 0 },
      // Herblore supplies: vials of water and the two potion secondaries.
      // Grimy herbs come from monster drops (see npcs.ts).
      { itemId: 'vial_of_water', price: 0 },
      { itemId: 'eye_of_newt', price: 0 },
      { itemId: 'limpwurt_root', price: 0 },
    ],
  },
  lumbridge_pub: {
    id: 'lumbridge_pub',
    name: 'The Sheared Ram',
    // The pub buys back empty glasses (and the odd item) at 40% of value.
    sellRate: 0.4,
    stock: [{ itemId: 'beer', price: 2 }],
  },
}
