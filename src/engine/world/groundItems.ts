import type { EventBus } from '../core/eventBus'
import type { Game } from '../core/game'
import type { PlayerAction } from '../entities/player'
import { getItemDef } from '../systems/itemRegistry'

/** Ticks a dropped item stays on the ground before despawning (2 minutes). */
export const GROUND_ITEM_DESPAWN_TICKS = 200

/** An item stack lying on a world tile. */
export interface GroundItem {
  /** Unique id per spawned stack (stable handle for the UI and pickup). */
  readonly id: number
  readonly itemId: string
  /** Mutable: a partial pickup of a stackable shrinks the ground stack. */
  quantity: number
  readonly x: number
  readonly y: number
  /** Tick at which the stack disappears (checked in Game.tick). */
  readonly despawnAtTick: number
}

// Ground item events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when an item stack is dropped on the ground. */
    groundItemAdded: { id: number; itemId: string; quantity: number; x: number; y: number }
    /** Emitted when a ground stack disappears (picked up or timed out). */
    groundItemRemoved: {
      id: number
      itemId: string
      x: number
      y: number
      reason: 'picked_up' | 'despawned'
    }
  }
}

/**
 * All item stacks lying on the ground. Owned by Game, which calls
 * `despawnDue` once per tick (after entity updates) to expire old stacks.
 */
export class GroundItemManager {
  private readonly _items: GroundItem[] = []
  private nextId = 1

  constructor(private readonly events: EventBus) {}

  /** All ground stacks, in drop order. */
  get items(): readonly GroundItem[] {
    return this._items
  }

  /** Ground stacks on tile (x, y), in drop order. */
  itemsAt(x: number, y: number): GroundItem[] {
    return this._items.filter((item) => item.x === x && item.y === y)
  }

  /** True while `item` is still on the ground. */
  contains(item: GroundItem): boolean {
    return this._items.includes(item)
  }

  /** Drop a stack on a tile. Emits `groundItemAdded`. */
  add(itemId: string, quantity: number, x: number, y: number, despawnAtTick: number): GroundItem {
    getItemDef(itemId) // fail fast on unknown item ids
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`GroundItemManager.add: quantity must be a positive integer, got ${quantity}`)
    }
    const item: GroundItem = { id: this.nextId++, itemId, quantity, x, y, despawnAtTick }
    this._items.push(item)
    this.events.emit('groundItemAdded', { id: item.id, itemId, quantity, x, y })
    return item
  }

  /** Remove a stack from the ground. Emits `groundItemRemoved` when found. */
  remove(item: GroundItem, reason: 'picked_up' | 'despawned'): boolean {
    const index = this._items.indexOf(item)
    if (index === -1) return false
    this._items.splice(index, 1)
    const { id, itemId, x, y } = item
    this.events.emit('groundItemRemoved', { id, itemId, x, y, reason })
    return true
  }

  /** Remove every stack whose despawn tick has been reached. */
  despawnDue(tick: number): void {
    // Iterate a snapshot: remove() splices the live array.
    for (const item of [...this._items]) {
      if (tick >= item.despawnAtTick) this.remove(item, 'despawned')
    }
  }
}

/**
 * Tick-driven pickup of a ground item. Started via `player.pickUp(item)`,
 * which queues a walk to the item's tile and sets this action; it ticks
 * once the player arrives (same walk-then-act pattern as gathering).
 *
 * On tick: ends silently when the walk was interrupted or the item is gone
 * (picked up is instant, so the action runs for exactly one tick). Adds as
 * much as fits into the inventory; when nothing (or only part of a stack)
 * fits, emits `actionFailed: inventory_full` and leaves the rest on the
 * ground with its original despawn timer.
 */
export class PickUpAction implements PlayerAction {
  constructor(private readonly item: GroundItem) {}

  onTick(game: Game): boolean {
    const { player, events, groundItems } = game
    if (player.x !== this.item.x || player.y !== this.item.y) return false
    if (!groundItems.contains(this.item)) return false

    const added = player.inventory.add(this.item.itemId, this.item.quantity)
    if (added < this.item.quantity) {
      this.item.quantity -= added
      events.emit('actionFailed', { reason: 'inventory_full' })
      return false
    }
    groundItems.remove(this.item, 'picked_up')
    return false
  }
}
