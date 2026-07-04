import { useState } from 'react'
import type { MouseEvent } from 'react'
import type { Game } from '../../engine'
import { getItemDef } from '../../engine'
import { ContextMenu, type MenuOption, type MenuState } from '../ContextMenu'
import { itemColor } from '../itemColor'
import type { MessageStore } from '../messages'

/**
 * Shop interface, shown while game.shop.isOpen (replaces the tabbed side
 * panel, like the bank). Lists the open shop's stock with its price per
 * item; click buys 1, right-click offers Buy-5 and Examine. Stock never
 * sells out (see ShopDef), so quantities are not shown.
 */
export function ShopPanel({
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
    <div className="bank-panel shop-panel">
      <div className="bank-header">
        <span>{def.name}</span>
        <button
          type="button"
          className="bank-close"
          onClick={() => {
            shop.close()
            refresh()
          }}
        >
          Close
        </button>
      </div>

      <div className="item-grid bank-grid">
        {shop.stock.map(({ itemId, price }) => {
          const item = getItemDef(itemId)
          const priceLabel = price === 0 ? 'Free' : `${price} gp`
          return (
            <button
              type="button"
              key={itemId}
              className="item-slot filled"
              style={{ background: itemColor(itemId) }}
              title={`${item.name} — ${priceLabel}`}
              onClick={() => {
                shop.buy(itemId, 1)
                refresh()
              }}
              onContextMenu={(e) =>
                openMenu(e, [
                  { label: `Buy ${item.name} (${priceLabel})`, onClick: () => shop.buy(itemId, 1) },
                  { label: `Buy-5 ${item.name}`, onClick: () => shop.buy(itemId, 5) },
                  { label: `Examine ${item.name}`, onClick: () => store.push(item.examine) },
                ])
              }
            >
              <span className="item-slot-name">{item.name}</span>
              <span className="item-slot-qty">{priceLabel}</span>
            </button>
          )
        })}
      </div>

      <div className="bank-subtitle">Click an item to buy it.</div>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
