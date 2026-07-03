// Static world object definitions (bank booths, cooking ranges).
// Data-only: plain objects, no logic.
import type { WorldObjectDef } from './types'

export const worldObjects: Record<string, WorldObjectDef> = {
  bank_booth: {
    id: 'bank_booth',
    name: 'Bank booth',
    examine: 'It has a large pile of gold behind it.',
    blocksMovement: true,
    bank: true,
  },
  cooking_range: {
    id: 'cooking_range',
    name: 'Cooking range',
    examine: 'A hot cooking range.',
    blocksMovement: true,
    cookingSource: true,
  },
}
