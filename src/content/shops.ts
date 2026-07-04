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
    ],
  },
}
