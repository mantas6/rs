import type { EventBus } from '../core/eventBus'
import type { Game } from '../core/game'
import type { PlayerAction } from '../entities/player'
import { chebyshev } from '../world/vec2'
import type { WorldObject } from '../world/worldObject'
import type { Inventory } from './inventory'
import { getItemDef } from './itemRegistry'

/** Why a bank operation failed. */
export type BankFailReason = 'bank_closed' | 'invalid_source'

// Bank events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when the bank interface opens (player reached a booth). */
    bankOpened: Record<string, never>
    /** Emitted when the bank interface closes (command or movement). */
    bankClosed: Record<string, never>
    /** Emitted per deposit/withdraw; `quantity` is the new bank total. */
    bankChanged: { itemId: string; quantity: number }
  }
}

/** Deposit/withdraw amount: a positive integer or the whole stack. */
export type BankQuantity = number | 'all'

/**
 * The player's bank, owned by Game. Effectively unlimited: everything
 * stacks per item id (OSRS-style), stored as itemId -> quantity in
 * insertion order (stable for UI listing).
 *
 * Deposits and withdrawals operate on the player's inventory, so equipment
 * is never bankable directly — it must be unequipped into the inventory
 * first. Operations require the bank to be open (player.openBank walks to
 * a booth and opens it); any player movement closes it again, which this
 * class detects by listening to `playerMoved`.
 */
export class Bank {
  private readonly contents = new Map<string, number>()
  private _open = false

  constructor(
    private readonly events: EventBus,
    private readonly inventory: Inventory,
  ) {
    // Any movement (walking, teleports) closes the bank, OSRS-style.
    events.on('playerMoved', () => {
      if (this._open) this.close()
    })
  }

  get isOpen(): boolean {
    return this._open
  }

  /** Bank contents as (itemId, quantity) pairs, in first-deposit order. */
  get items(): ReadonlyArray<{ itemId: string; quantity: number }> {
    return [...this.contents].map(([itemId, quantity]) => ({ itemId, quantity }))
  }

  /** Quantity of an item stored in the bank. */
  count(itemId: string): number {
    return this.contents.get(itemId) ?? 0
  }

  /** Open the bank interface. Emits `bankOpened` (no-op when open). */
  open(): void {
    if (this._open) return
    this._open = true
    this.events.emit('bankOpened', {})
  }

  /** Close the bank interface. Emits `bankClosed` (no-op when closed). */
  close(): void {
    if (!this._open) return
    this._open = false
    this.events.emit('bankClosed', {})
  }

  /**
   * Deposit up to `quantity` ('all' = every held one) of an item from the
   * inventory. Returns the quantity actually banked (0 when none held).
   * Emits `actionFailed: bank_closed` and returns 0 when the bank is shut.
   */
  deposit(itemId: string, quantity: BankQuantity = 1): number {
    if (!this.requireOpen()) return 0
    getItemDef(itemId) // fail fast on unknown item ids
    const held = this.inventory.count(itemId)
    const wanted = quantity === 'all' ? held : Math.min(this.validQuantity(quantity), held)
    if (wanted <= 0) return 0
    const removed = this.inventory.remove(itemId, wanted)
    this.addToContents(itemId, removed)
    return removed
  }

  /** Deposit the entire inventory. Returns the number of items banked. */
  depositAll(): number {
    if (!this.requireOpen()) return 0
    const itemIds = new Set<string>()
    for (const slot of this.inventory.slots) {
      if (slot) itemIds.add(slot.itemId)
    }
    let total = 0
    for (const itemId of itemIds) total += this.deposit(itemId, 'all')
    return total
  }

  /**
   * Withdraw up to `quantity` ('all' = the full bank stack) of an item into
   * the inventory, respecting inventory space: non-stackables occupy one
   * slot each (partial withdrawals allowed), stackables merge into one
   * slot. Returns the quantity actually withdrawn; emits `actionFailed:
   * inventory_full` when less than requested fits. Emits `actionFailed:
   * bank_closed` and returns 0 when the bank is shut.
   */
  withdraw(itemId: string, quantity: BankQuantity = 1): number {
    if (!this.requireOpen()) return 0
    const banked = this.count(itemId)
    const wanted = quantity === 'all' ? banked : Math.min(this.validQuantity(quantity), banked)
    if (wanted <= 0) return 0
    const added = this.inventory.add(itemId, wanted)
    if (added < wanted) this.events.emit('actionFailed', { reason: 'inventory_full' })
    if (added > 0) this.addToContents(itemId, -added)
    return added
  }

  private requireOpen(): boolean {
    if (this._open) return true
    this.events.emit('actionFailed', { reason: 'bank_closed' })
    return false
  }

  private validQuantity(quantity: number): number {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Bank: quantity must be a positive integer or 'all', got ${quantity}`)
    }
    return quantity
  }

  private addToContents(itemId: string, delta: number): void {
    const next = this.count(itemId) + delta
    if (next <= 0) this.contents.delete(itemId)
    else this.contents.set(itemId, next)
    this.events.emit('bankChanged', { itemId, quantity: Math.max(0, next) })
  }
}

/**
 * Tick-driven bank opening. Started via `player.openBank(booth)`, which
 * queues a walk to a tile adjacent to the booth and sets this action
 * (walk-then-act, same as gathering). On arrival it opens the bank and
 * ends; it ends silently when the walk was interrupted.
 */
export class OpenBankAction implements PlayerAction {
  constructor(private readonly booth: WorldObject) {}

  onTick(game: Game): boolean {
    if (chebyshev(game.player.position, this.booth.position) !== 1) return false
    game.bank.open()
    return false
  }
}
