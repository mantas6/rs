import { useState } from 'react'
import type { MouseEvent } from 'react'
import type { Game } from '../../engine'
import { getItemDef } from '../../engine'
import { ContextMenu, type MenuOption, type MenuState } from '../ContextMenu'
import { ItemIcon } from '../icons/ItemIcon'
import { Modal } from '../Modal'
import type { MessageStore } from '../messages'

/**
 * Shop interface, rendered as a modal overlay while game.shop.isOpen. Left
 * grid = the open shop's stock with its price per item (click buys 1,
 * right-click Buy-5/Examine); right grid = the player's inventory (click
 * sells 1, right-click Sell/Sell-5/Examine) when the shop buys items. Stock
 * never sells out (see ShopDef), so quantities are not shown. Closing (X,
 * Escape, or backdrop) issues game.shop.close(); the modal is only mounted
 * while the engine reports a shop open.
 */
export function ShopModal({
  game,
  store,
  refresh,
}: {
  game: Game
  store: MessageStore
  refresh: () => void
}) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const shop = game.shop
  const def = shop.current
  if (!def) return null
  const buysItems = def.sellRate != null && def.sellRate > 0

  function close(): void {
    shop.close()
    refresh()
  }

  function openMenu(e: MouseEvent, options: MenuOption[]): void {
    e.preventDefault()
    const withRefresh = options.map((option) => ({
      label: option.label,
      onClick: () => {
        option.onClick()
        refresh()
      },
    }))
    setMenu({ x: e.clientX, y: e.clientY, options: withRefresh })
  }

  return (
    <Modal title={def.name} className="shop-modal" onClose={close}>
      <div className="bank-layout">
        <div className="bank-column bank-column-main">
          <div className="bank-subtitle">Click an item to buy it.</div>
          <div className="item-grid bank-grid">
            {shop.stock.map(({ itemId, price }) => {
              const item = getItemDef(itemId)
              const priceLabel = price === 0 ? 'Free' : `${price} gp`
              return (
                <button
                  type="button"
                  key={itemId}
                  className="item-slot filled"
                  title={`${item.name} — ${priceLabel}`}
                  onClick={() => {
                    shop.buy(itemId, 1)
                    refresh()
                  }}
                  onContextMenu={(e) =>
                    openMenu(e, [
                      {
                        label: `Buy ${item.name} (${priceLabel})`,
                        onClick: () => shop.buy(itemId, 1),
                      },
                      { label: `Buy-5 ${item.name}`, onClick: () => shop.buy(itemId, 5) },
                      { label: `Examine ${item.name}`, onClick: () => store.push(item.examine) },
                    ])
                  }
                >
                  <ItemIcon itemId={itemId} />
                  <span className="item-slot-qty">{priceLabel}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="bank-column bank-column-inv">
          <div className="bank-subtitle">
            {buysItems ? 'Click an item to sell it.' : 'Your inventory'}
          </div>
          <div className="item-grid inv-grid">
            {game.player.inventory.slots.map((slot, index) =>
              slot ? (
                <button
                  type="button"
                  key={index}
                  className="item-slot filled"
                  title={
                    buysItems
                      ? `${getItemDef(slot.itemId).name} — sell for ${shop.sellPrice(slot.itemId)} gp`
                      : getItemDef(slot.itemId).name
                  }
                  onClick={() => {
                    if (buysItems) shop.sell(slot.itemId, 1)
                    else store.push(getItemDef(slot.itemId).examine)
                    refresh()
                  }}
                  onContextMenu={(e) => {
                    const itemDef = getItemDef(slot.itemId)
                    const options: MenuOption[] = []
                    if (buysItems) {
                      const priceLabel = `${shop.sellPrice(itemDef.id)} gp`
                      options.push(
                        {
                          label: `Sell ${itemDef.name} (${priceLabel})`,
                          onClick: () => shop.sell(itemDef.id, 1),
                        },
                        { label: `Sell-5 ${itemDef.name}`, onClick: () => shop.sell(itemDef.id, 5) },
                      )
                    }
                    options.push({
                      label: `Examine ${itemDef.name}`,
                      onClick: () => store.push(itemDef.examine),
                    })
                    openMenu(e, options)
                  }}
                >
                  <ItemIcon itemId={slot.itemId} />
                  {slot.quantity > 1 && <span className="item-slot-qty">{slot.quantity}</span>}
                </button>
              ) : (
                <div key={index} className="item-slot" onContextMenu={(e) => e.preventDefault()} />
              ),
            )}
          </div>
        </div>
      </div>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </Modal>
  )
}
