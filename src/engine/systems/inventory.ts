import type { EventBus } from '../core/eventBus'
import { getItemDef } from './itemRegistry'

/** Number of inventory slots (OSRS backpack). */
export const INVENTORY_SIZE = 28

/** Maximum quantity of a stackable item in one slot. */
export const MAX_STACK = 2 ** 31 - 1

/** One occupied slot: a non-stackable item (quantity 1) or a stack. */
export interface ItemStack {
  itemId: string
  quantity: number
}

/** JSON-safe snapshot of all 28 slots (see Inventory.serialize). */
export type InventorySave = (ItemStack | null)[]

// Inventory events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted whenever inventory contents change. */
    inventoryChanged: { slots: ReadonlyArray<Readonly<ItemStack> | null> }
  }
}

/**
 * 28-slot player inventory. Stackable items merge into a single slot
 * (quantity capped at MAX_STACK); non-stackable items occupy one slot each
 * with quantity 1. Partial adds/removes are allowed — `add` and `remove`
 * return how much was actually moved.
 */
export class Inventory {
  private readonly _slots: (ItemStack | null)[] = new Array(INVENTORY_SIZE).fill(null)

  constructor(private readonly events: EventBus) {}

  /** Readonly view of all 28 slots (null = empty). */
  get slots(): ReadonlyArray<Readonly<ItemStack> | null> {
    return this._slots
  }

  get(slot: number): Readonly<ItemStack> | null {
    if (!Number.isInteger(slot) || slot < 0 || slot >= INVENTORY_SIZE) {
      throw new Error(`Inventory.get: slot must be an integer in [0, ${INVENTORY_SIZE}), got ${slot}`)
    }
    return this._slots[slot]
  }

  get freeSlots(): number {
    return this._slots.reduce((n, s) => n + (s === null ? 1 : 0), 0)
  }

  get isFull(): boolean {
    return this.freeSlots === 0
  }

  /** Total quantity of an item across all slots. */
  count(itemId: string): number {
    let total = 0
    for (const slot of this._slots) {
      if (slot?.itemId === itemId) total += slot.quantity
    }
    return total
  }

  has(itemId: string, quantity = 1): boolean {
    return this.count(itemId) >= quantity
  }

  /**
   * Add up to `quantity` of an item. Returns the quantity actually added
   * (0 when full). Stackables merge into one slot; non-stackables fill one
   * free slot each, allowing partial adds.
   */
  add(itemId: string, quantity = 1): number {
    const def = getItemDef(itemId)
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Inventory.add: quantity must be a positive integer, got ${quantity}`)
    }

    let added = 0
    if (def.stackable) {
      let index = this._slots.findIndex((s) => s?.itemId === itemId)
      if (index === -1) index = this._slots.indexOf(null)
      if (index !== -1) {
        const existing = this._slots[index]?.quantity ?? 0
        added = Math.min(quantity, MAX_STACK - existing)
        if (added > 0) this._slots[index] = { itemId, quantity: existing + added }
      }
    } else {
      for (let i = 0; i < INVENTORY_SIZE && added < quantity; i++) {
        if (this._slots[i] !== null) continue
        this._slots[i] = { itemId, quantity: 1 }
        added++
      }
    }

    if (added > 0) this.emitChanged()
    return added
  }

  /**
   * Remove up to `quantity` of an item (scanning slots in order). Returns
   * the quantity actually removed.
   */
  remove(itemId: string, quantity = 1): number {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Inventory.remove: quantity must be a positive integer, got ${quantity}`)
    }
    let remaining = quantity
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      const slot = this._slots[i]
      if (slot?.itemId !== itemId) continue
      const taken = Math.min(slot.quantity, remaining)
      remaining -= taken
      if (taken === slot.quantity) this._slots[i] = null
      else this._slots[i] = { itemId, quantity: slot.quantity - taken }
    }
    const removed = quantity - remaining
    if (removed > 0) this.emitChanged()
    return removed
  }

  /**
   * Remove up to `quantity` from a specific slot (the whole stack when
   * omitted). Returns the removed stack, or null when the slot was empty.
   */
  removeSlot(slotIndex: number, quantity?: number): ItemStack | null {
    const slot = this.get(slotIndex)
    if (slot === null) return null
    const taken = quantity === undefined ? slot.quantity : Math.min(quantity, slot.quantity)
    if (!Number.isInteger(taken) || taken < 1) {
      throw new Error(`Inventory.removeSlot: quantity must be a positive integer, got ${quantity}`)
    }
    if (taken === slot.quantity) this._slots[slotIndex] = null
    else this._slots[slotIndex] = { itemId: slot.itemId, quantity: slot.quantity - taken }
    this.emitChanged()
    return { itemId: slot.itemId, quantity: taken }
  }

  /**
   * Swap the contents of two slots (used for drag-to-rearrange). Either slot
   * may be empty, letting an item be dragged into a free slot. A no-op when
   * both indices are equal or both slots are empty; otherwise emits
   * `inventoryChanged`. Throws on out-of-range indices.
   */
  swap(a: number, b: number): void {
    if (!Number.isInteger(a) || a < 0 || a >= INVENTORY_SIZE) {
      throw new Error(`Inventory.swap: slot must be an integer in [0, ${INVENTORY_SIZE}), got ${a}`)
    }
    if (!Number.isInteger(b) || b < 0 || b >= INVENTORY_SIZE) {
      throw new Error(`Inventory.swap: slot must be an integer in [0, ${INVENTORY_SIZE}), got ${b}`)
    }
    if (a === b) return
    if (this._slots[a] === null && this._slots[b] === null) return
    const tmp = this._slots[a]
    this._slots[a] = this._slots[b]
    this._slots[b] = tmp
    this.emitChanged()
  }

  clear(): void {
    let changed = false
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      if (this._slots[i] !== null) {
        this._slots[i] = null
        changed = true
      }
    }
    if (changed) this.emitChanged()
  }

  /** JSON-safe copy of all slots, for save/load. */
  serialize(): InventorySave {
    return this._slots.map((s) => (s ? { itemId: s.itemId, quantity: s.quantity } : null))
  }

  /**
   * Restore a snapshot from `serialize()`. Throws on unknown item ids or
   * invalid quantities. Emits no events: restore runs during game
   * construction, before any listeners subscribe.
   */
  restore(save: InventorySave): void {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const stack = save[i] ?? null
      if (stack === null) {
        this._slots[i] = null
        continue
      }
      getItemDef(stack.itemId) // fail fast on unknown item ids
      if (!Number.isInteger(stack.quantity) || stack.quantity < 1) {
        throw new Error(`Inventory.restore: invalid quantity ${stack.quantity} in slot ${i}`)
      }
      this._slots[i] = { itemId: stack.itemId, quantity: stack.quantity }
    }
  }

  private emitChanged(): void {
    this.events.emit('inventoryChanged', { slots: this.slots })
  }
}
