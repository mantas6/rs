import { items } from '../../content/items'
import type { EquipmentBonuses, ItemDef } from '../../content/types'

/**
 * Item lookup for engine code. Content stays data-only; this module is the
 * engine's typed gateway into the item record.
 */
export function getItemDef(id: string): ItemDef {
  const def = items[id]
  if (!def) throw new Error(`Unknown item id: ${id}`)
  return def
}

/** True when an item id exists in the content registry. */
export function isItemId(id: string): boolean {
  return id in items
}

/** A zeroed bonuses object (fresh instance each call — safe to mutate). */
export function emptyBonuses(): EquipmentBonuses {
  return {
    attackStab: 0,
    attackSlash: 0,
    attackCrush: 0,
    attackMagic: 0,
    attackRanged: 0,
    defenceStab: 0,
    defenceSlash: 0,
    defenceCrush: 0,
    defenceMagic: 0,
    defenceRanged: 0,
    meleeStrength: 0,
    rangedStrength: 0,
    magicDamage: 0,
    prayer: 0,
  }
}

/** Expand content's partial bonuses into the full shape (missing = 0). */
export function normalizeBonuses(partial: Partial<EquipmentBonuses> = {}): EquipmentBonuses {
  return { ...emptyBonuses(), ...partial }
}
