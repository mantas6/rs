import type { EquipmentBonuses, EquipmentSlot } from '../../content/types'
import type { EventBus } from '../core/eventBus'
import type { Inventory, ItemStack } from './inventory'
import { emptyBonuses, getItemDef, normalizeBonuses } from './itemRegistry'
import type { SkillName, Skills } from './skills'

/** All equipment slots, in the usual display order. */
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'head',
  'cape',
  'neck',
  'ammo',
  'weapon',
  'body',
  'shield',
  'legs',
  'hands',
  'feet',
  'ring',
] as const

/** Attack speed in ticks when no weapon is equipped (unarmed). */
export const UNARMED_ATTACK_SPEED = 4

// Equipment events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted whenever a worn-equipment slot changes. */
    equipmentChanged: { slot: EquipmentSlot; item: Readonly<ItemStack> | null }
  }
}

/**
 * Worn equipment. Items move between here and an Inventory via
 * `equip`/`unequip`; requirements are checked against BASE skill levels.
 *
 * TODO: two-handed weapons (must also vacate the shield slot). None exist
 * in the current item set, so equip() treats every weapon as one-handed.
 */
export class Equipment {
  private readonly items = new Map<EquipmentSlot, ItemStack>()

  constructor(private readonly events: EventBus) {}

  get(slot: EquipmentSlot): Readonly<ItemStack> | null {
    return this.items.get(slot) ?? null
  }

  /**
   * Equip an item out of the inventory, identified by slot index or item id
   * (first matching slot). Requirements are validated against base skill
   * levels. Any previously equipped item in the target slot is swapped back
   * into the inventory. Returns true on success; on failure the inventory
   * is left unchanged.
   */
  equip(inventory: Inventory, skills: Skills, slotOrItemId: number | string): boolean {
    const slotIndex =
      typeof slotOrItemId === 'number'
        ? slotOrItemId
        : inventory.slots.findIndex((s) => s?.itemId === slotOrItemId)
    if (slotIndex < 0) return false
    const stack = inventory.get(slotIndex)
    if (stack === null) return false

    const def = getItemDef(stack.itemId)
    if (!def.equipment) return false
    for (const [skill, level] of Object.entries(def.equipment.requirements ?? {})) {
      if (level !== undefined && skills.getLevel(skill as SkillName) < level) return false
    }

    const slot = def.equipment.slot
    const removed = inventory.removeSlot(slotIndex) as ItemStack
    const previous = this.items.get(slot) ?? null
    if (previous) {
      // Swap: the freed inventory slot takes the old item. Only stackable
      // equipment could fail here (removal may not free a slot); roll back.
      const returned = inventory.add(previous.itemId, previous.quantity)
      if (returned < previous.quantity) {
        if (returned > 0) inventory.remove(previous.itemId, returned)
        inventory.add(removed.itemId, removed.quantity)
        return false
      }
    }
    this.items.set(slot, removed)
    this.events.emit('equipmentChanged', { slot, item: removed })
    return true
  }

  /**
   * Move the item in `slot` back to the inventory. Fails (returns false,
   * nothing changes) when the slot is empty or the inventory lacks space.
   */
  unequip(slot: EquipmentSlot, inventory: Inventory): boolean {
    const stack = this.items.get(slot)
    if (!stack) return false
    const added = inventory.add(stack.itemId, stack.quantity)
    if (added < stack.quantity) {
      if (added > 0) inventory.remove(stack.itemId, added)
      return false
    }
    this.items.delete(slot)
    this.events.emit('equipmentChanged', { slot, item: null })
    return true
  }

  /** Sum of stat bonuses across all equipped items (used by combat). */
  totalBonuses(): EquipmentBonuses {
    const total = emptyBonuses()
    for (const stack of this.items.values()) {
      const bonuses = normalizeBonuses(getItemDef(stack.itemId).equipment?.bonuses)
      for (const key of Object.keys(total) as (keyof EquipmentBonuses)[]) {
        total[key] += bonuses[key]
      }
    }
    return total
  }

  /** Attack speed in ticks of the equipped weapon (4 when unarmed). */
  weaponSpeed(): number {
    const weapon = this.items.get('weapon')
    if (!weapon) return UNARMED_ATTACK_SPEED
    return getItemDef(weapon.itemId).equipment?.attackSpeed ?? UNARMED_ATTACK_SPEED
  }
}
