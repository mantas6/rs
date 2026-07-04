// Static world object definitions (bank booths, cooking ranges, shop
// counters). Data-only: plain objects, no logic.
import type { WorldObjectDef } from './types'

export const worldObjects: Record<string, WorldObjectDef> = {
  bank_booth: {
    id: 'bank_booth',
    name: 'Bank booth',
    examine: 'It has a large pile of gold behind it.',
    blocksMovement: true,
    bank: true,
  },
  shop_counter: {
    id: 'shop_counter',
    name: 'Shop counter',
    examine: 'The shopkeeper hands out starter gear for free.',
    blocksMovement: true,
    shop: 'lumbridge_general_store',
  },
  cooking_range: {
    id: 'cooking_range',
    name: 'Cooking range',
    examine: 'A hot cooking range.',
    blocksMovement: true,
    cookingSource: true,
  },
  furnace: {
    id: 'furnace',
    name: 'Furnace',
    examine: 'Used to smelt ore into bars.',
    blocksMovement: true,
    smeltingSource: true,
  },
  anvil: {
    id: 'anvil',
    name: 'Anvil',
    examine: 'Used to hammer bars into equipment.',
    blocksMovement: true,
    anvilSource: true,
  },
  tannery: {
    id: 'tannery',
    name: 'Tannery',
    examine: 'Used to tan hides into leather.',
    blocksMovement: true,
    tanningSource: true,
  },
  bar_counter: {
    id: 'bar_counter',
    name: 'Bar',
    examine: 'A well-worn bar counter. The barman is pulling pints.',
    blocksMovement: true,
    shop: 'lumbridge_pub',
  },
}
