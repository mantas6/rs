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

/** JSON-safe snapshot of worn equipment (see Equipment.serialize). */
export type EquipmentSave = Partial<Record<EquipmentSlot, ItemStack>>

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
 * Two-handed weapons (EquipmentDef.twoHanded) occupy the weapon slot but
 * also block the shield slot: equipping one vacates any worn shield, and
 * equipping a shield vacates a worn two-handed weapon.
 */
export class Equipment {
  private readonly items = new Map<EquipmentSlot, ItemStack>()

  constructor(private readonly events: EventBus) {}

  get(slot: EquipmentSlot): Readonly<ItemStack> | null {
    return this.items.get(slot) ?? null
  }

  /** True when `stack` is a two-handed weapon (occupies weapon, blocks shield). */
  private isTwoHanded(stack: ItemStack): boolean {
    const equipment = getItemDef(stack.itemId).equipment
    return equipment?.slot === 'weapon' && equipment.twoHanded === true
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

    // Collect every worn slot that must be vacated for this equip: always the
    // target slot, plus the shield when equipping a two-handed weapon, or the
    // weapon when equipping a shield over a worn two-handed weapon.
    const vacated: { slot: EquipmentSlot; stack: ItemStack }[] = []
    const previous = this.items.get(slot) ?? null
    if (previous) vacated.push({ slot, stack: previous })
    if (slot === 'weapon' && def.equipment.twoHanded === true) {
      const shield = this.items.get('shield') ?? null
      if (shield) vacated.push({ slot: 'shield', stack: shield })
    } else if (slot === 'shield') {
      const weapon = this.items.get('weapon') ?? null
      if (weapon && this.isTwoHanded(weapon)) vacated.push({ slot: 'weapon', stack: weapon })
    }

    // Return every displaced item to the inventory. The single slot freed by
    // removing the item being equipped may not hold both displaced items, so
    // roll back cleanly (restore inventory + equipment) if any fails to fit.
    const returnedBack: ItemStack[] = []
    for (const entry of vacated) {
      const returned = inventory.add(entry.stack.itemId, entry.stack.quantity)
      if (returned < entry.stack.quantity) {
        if (returned > 0) inventory.remove(entry.stack.itemId, returned)
        for (const done of returnedBack) inventory.remove(done.itemId, done.quantity)
        inventory.add(removed.itemId, removed.quantity)
        return false
      }
      returnedBack.push(entry.stack)
    }

    // Commit: clear every vacated slot, install the new item, then emit for
    // each slot that changed (vacated shields/weapons first, then the target).
    for (const entry of vacated) this.items.delete(entry.slot)
    this.items.set(slot, removed)
    for (const entry of vacated) {
      if (entry.slot !== slot) this.events.emit('equipmentChanged', { slot: entry.slot, item: null })
    }
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

  /** JSON-safe copy of every worn slot, for save/load. */
  serialize(): EquipmentSave {
    const save: EquipmentSave = {}
    for (const [slot, stack] of this.items) {
      save[slot] = { itemId: stack.itemId, quantity: stack.quantity }
    }
    return save
  }

  /**
   * Restore a snapshot from `serialize()`. Throws on unknown item ids.
   * Emits no events: restore runs during game construction, before any
   * listeners subscribe.
   */
  restore(save: EquipmentSave): void {
    this.items.clear()
    for (const slot of EQUIPMENT_SLOTS) {
      const stack = save[slot]
      if (!stack) continue
      getItemDef(stack.itemId) // fail fast on unknown item ids
      this.items.set(slot, { itemId: stack.itemId, quantity: stack.quantity })
    }
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
