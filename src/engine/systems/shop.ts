import { shops } from '../../content/shops'
import type { ShopDef, ShopStockEntry } from '../../content/types'
import type { EventBus } from '../core/eventBus'
import type { Game } from '../core/game'
import type { PlayerAction } from '../entities/player'
import { chebyshev, type Vec2 } from '../world/vec2'
import type { WorldObject } from '../world/worldObject'
import type { Inventory } from './inventory'
import { getItemDef } from './itemRegistry'

/** Why a shop operation failed. */
export type ShopFailReason =
  | 'shop_closed'
  | 'item_not_stocked'
  | 'not_enough_coins'
  | 'item_not_bought'
  | 'nothing_to_sell'

// Shop events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when a shop interface opens (player reached a counter). */
    shopOpened: { shopId: string }
    /** Emitted when the shop interface closes (command or movement). */
    shopClosed: Record<string, never>
    /** Emitted per purchase; `quantity` is what actually reached the inventory. */
    itemBought: { itemId: string; quantity: number; cost: number }
    /** Emitted per sale; `quantity` is what actually left the inventory. */
    itemSold: { itemId: string; quantity: number; revenue: number }
  }
}

/**
 * Shop lookup for engine code. Content stays data-only; this is the
 * engine's typed gateway into the shop record (mirrors itemRegistry).
 */
export function getShopDef(id: string): ShopDef {
  const def = shops[id]
  if (!def) throw new Error(`Unknown shop id: ${id}`)
  return def
}

/**
 * The shop interface, owned by Game. Shops themselves are stateless data
 * (stock never sells out; see ShopDef), so this class only tracks which
 * shop is currently open and executes purchases against the player's
 * inventory: buying moves items in and coins out (price 0 = free).
 *
 * Operations require a shop to be open (player.openShop walks to a counter
 * and opens it); any player movement closes it again, which this class
 * detects by listening to `playerMoved` — same pattern as the bank.
 */
export class Shop {
  private _current: ShopDef | null = null

  constructor(
    private readonly events: EventBus,
    private readonly inventory: Inventory,
  ) {
    // Any movement (walking, teleports) closes the shop, OSRS-style.
    events.on('playerMoved', () => {
      if (this._current) this.close()
    })
  }

  get isOpen(): boolean {
    return this._current !== null
  }

  /** The shop currently open, or null. */
  get current(): ShopDef | null {
    return this._current
  }

  /** Stock of the open shop ([] when closed), for UI listing. */
  get stock(): ReadonlyArray<Readonly<ShopStockEntry>> {
    return this._current?.stock ?? []
  }

  /**
   * Open a shop interface. Emits `shopOpened` (no-op when this shop is
   * already open); switching from another open shop closes it first.
   */
  open(def: ShopDef): void {
    if (this._current === def) return
    if (this._current) this.close()
    this._current = def
    this.events.emit('shopOpened', { shopId: def.id })
  }

  /** Close the shop interface. Emits `shopClosed` (no-op when closed). */
  close(): void {
    if (!this._current) return
    this._current = null
    this.events.emit('shopClosed', {})
  }

  /**
   * Buy up to `quantity` of an item from the open shop, paying its stock
   * price per item (0 = free). Purchases are limited by the coins held and
   * by inventory space (non-stackables need one free slot each); only
   * items that actually fit are paid for. Returns the quantity bought.
   * Emits `actionFailed` with `shop_closed` / `item_not_stocked` /
   * `not_enough_coins` / `inventory_full` on the respective shortfalls,
   * and `itemBought` when at least one item was purchased.
   */
  buy(itemId: string, quantity = 1): number {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Shop.buy: quantity must be a positive integer, got ${quantity}`)
    }
    if (!this._current) {
      this.events.emit('actionFailed', { reason: 'shop_closed' })
      return 0
    }
    const entry = this._current.stock.find((s) => s.itemId === itemId)
    if (!entry) {
      this.events.emit('actionFailed', { reason: 'item_not_stocked' })
      return 0
    }
    getItemDef(itemId) // fail fast on unknown item ids in content
    const affordable =
      entry.price === 0
        ? quantity
        : Math.min(quantity, Math.floor(this.inventory.count('coins') / entry.price))
    if (affordable < quantity) this.events.emit('actionFailed', { reason: 'not_enough_coins' })
    if (affordable <= 0) return 0
    const bought = this.inventory.add(itemId, affordable)
    if (bought < affordable) this.events.emit('actionFailed', { reason: 'inventory_full' })
    if (bought <= 0) return 0
    const cost = bought * entry.price
    if (cost > 0) this.inventory.remove('coins', cost)
    this.events.emit('itemBought', { itemId, quantity: bought, cost })
    return bought
  }

  /**
   * Coins the open shop pays per item sold, i.e. `floor(value * sellRate)`.
   * Returns 0 when no shop is open, when the shop does not buy items (no
   * `sellRate`), or for coins themselves (which are the currency, not goods).
   */
  sellPrice(itemId: string): number {
    if (!this._current?.sellRate || itemId === 'coins') return 0
    return Math.floor(getItemDef(itemId).value * this._current.sellRate)
  }

  /**
   * Sell up to `quantity` of an item from the inventory to the open shop,
   * receiving `sellPrice(itemId)` coins per item (see above). Selling is
   * capped by how many the player actually holds. Returns the quantity sold.
   * Emits `actionFailed` with `shop_closed` (no shop open), `item_not_bought`
   * (shop refuses this item), or `nothing_to_sell` (none held); and
   * `itemSold` when at least one item was sold.
   */
  sell(itemId: string, quantity = 1): number {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Shop.sell: quantity must be a positive integer, got ${quantity}`)
    }
    if (!this._current) {
      this.events.emit('actionFailed', { reason: 'shop_closed' })
      return 0
    }
    if (!this._current.sellRate || itemId === 'coins') {
      this.events.emit('actionFailed', { reason: 'item_not_bought' })
      return 0
    }
    const held = this.inventory.count(itemId)
    if (held <= 0) {
      this.events.emit('actionFailed', { reason: 'nothing_to_sell' })
      return 0
    }
    const sold = Math.min(quantity, held)
    this.inventory.remove(itemId, sold)
    const revenue = sold * this.sellPrice(itemId)
    if (revenue > 0) this.inventory.add('coins', revenue)
    this.events.emit('itemSold', { itemId, quantity: sold, revenue })
    return sold
  }
}

/**
 * Tick-driven shop opening. Started via `player.openShop(counter)`, which
 * queues a walk to a tile adjacent to the counter and sets this action
 * (walk-then-act, same as banking). On arrival it opens the counter's shop
 * and ends; it ends silently when the walk was interrupted.
 */
export class OpenShopAction implements PlayerAction {
  readonly kind = 'shopping'

  constructor(private readonly counter: WorldObject) {}

  get targetPosition(): Readonly<Vec2> {
    return this.counter.position
  }

  onTick(game: Game): boolean {
    if (chebyshev(game.player.position, this.counter.position) !== 1) return false
    // openShop validated the def has a shop id before queuing this action.
    game.shop.open(getShopDef(this.counter.def.shop as string))
    return false
  }
}
