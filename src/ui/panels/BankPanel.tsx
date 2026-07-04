import { useState } from 'react'
import type { MouseEvent } from 'react'
import type { Game } from '../../engine'
import { getItemDef } from '../../engine'
import { ContextMenu, type MenuOption, type MenuState } from '../ContextMenu'
import { ItemIcon } from '../icons/ItemIcon'
import type { MessageStore } from '../messages'

/**
 * Bank interface, shown while game.bank.isOpen. Top grid = bank contents
 * (click withdraws 1, right-click 5/All); bottom grid = inventory (click
 * deposits 1, right-click 5/All/Deposit inventory).
 */
export function BankPanel({
  game,
  store,
  refresh,
}: {
  game: Game
  store: MessageStore
  refresh: () => void
}) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const bank = game.bank

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
    <div className="bank-panel">
      <div className="bank-header">
        <span>Bank of RS Clone</span>
        <button
          type="button"
          className="bank-close"
          onClick={() => {
            bank.close()
            refresh()
          }}
        >
          Close
        </button>
      </div>

      <div className="item-grid bank-grid">
        {bank.items.map(({ itemId, quantity }) => {
          const def = getItemDef(itemId)
          return (
            <button
              type="button"
              key={itemId}
              className="item-slot filled"
              title={`${def.name} x ${quantity}`}
              onClick={() => {
                bank.withdraw(itemId, 1)
                refresh()
              }}
              onContextMenu={(e) =>
                openMenu(e, [
                  { label: `Withdraw-5 ${def.name}`, onClick: () => bank.withdraw(itemId, 5) },
                  { label: `Withdraw-All ${def.name}`, onClick: () => bank.withdraw(itemId, 'all') },
                  { label: `Examine ${def.name}`, onClick: () => store.push(def.examine) },
                ])
              }
            >
              <ItemIcon itemId={itemId} />
              <span className="item-slot-qty">{quantity}</span>
            </button>
          )
        })}
        {bank.items.length === 0 && <div className="bank-empty">The bank is empty.</div>}
      </div>

      <div className="bank-subtitle">Inventory — click to deposit</div>
      <div className="item-grid inv-grid">
        {game.player.inventory.slots.map((slot, index) =>
          slot ? (
            <button
              type="button"
              key={index}
              className="item-slot filled"
              title={getItemDef(slot.itemId).name}
              onClick={() => {
                bank.deposit(slot.itemId, 1)
                refresh()
              }}
              onContextMenu={(e) => {
                const def = getItemDef(slot.itemId)
                openMenu(e, [
                  { label: `Deposit-5 ${def.name}`, onClick: () => bank.deposit(slot.itemId, 5) },
                  {
                    label: `Deposit-All ${def.name}`,
                    onClick: () => bank.deposit(slot.itemId, 'all'),
                  },
                  { label: 'Deposit inventory', onClick: () => bank.depositAll() },
                ])
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
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
