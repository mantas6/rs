import { useState } from 'react'
import type { MouseEvent } from 'react'
import { cookingRecipes, firemakingDefs } from '../../content/recipes'
import type { CookingSource, Game } from '../../engine'
import { chebyshev, getItemDef } from '../../engine'
import { ContextMenu, type MenuOption, type MenuState } from '../ContextMenu'
import { itemColor } from '../itemColor'
import type { MessageStore } from '../messages'

/** Nearest valid cooking source (burning fire or range), or null. */
function nearestCookingSource(game: Game): CookingSource | null {
  const candidates: CookingSource[] = [
    ...game.fires.fires.filter((fire) => !fire.expired),
    ...game.world.objects.filter((object) => object.def.cookingSource === true),
  ]
  let best: CookingSource | null = null
  let bestDistance = Infinity
  for (const source of candidates) {
    const distance = chebyshev(game.player.position, source.position)
    if (distance < bestDistance) {
      bestDistance = distance
      best = source
    }
  }
  return best
}

/**
 * 4x7 backpack grid. Left click runs the context-sensitive default
 * (equip / eat / light / cook / examine); right click opens the full menu.
 */
export function InventoryPanel({
  game,
  store,
  refresh,
}: {
  game: Game
  store: MessageStore
  refresh: () => void
}) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const slots = game.player.inventory.slots

  function equip(index: number): void {
    if (!game.player.equip(index)) {
      store.push("You don't meet the requirements to equip that.")
    }
  }

  function cook(itemId: string): void {
    const source = nearestCookingSource(game)
    if (source === null) store.push('There is no fire or range to cook that on.')
    else game.player.cook(itemId, source)
  }

  function defaultAction(index: number): void {
    const slot = slots[index]
    if (!slot) return
    const def = getItemDef(slot.itemId)
    if (def.equipment) equip(index)
    else if (def.healAmount !== undefined) game.player.eat(index)
    else if (firemakingDefs[slot.itemId]) game.player.lightFire(slot.itemId)
    else if (cookingRecipes[slot.itemId]) cook(slot.itemId)
    else store.push(def.examine)
    refresh()
  }

  function openMenu(e: MouseEvent, index: number): void {
    e.preventDefault()
    const slot = slots[index]
    if (!slot) return
    const def = getItemDef(slot.itemId)

    const options: MenuOption[] = []
    if (def.equipment) options.push({ label: `Equip ${def.name}`, onClick: () => equip(index) })
    if (def.healAmount !== undefined) {
      options.push({ label: `Eat ${def.name}`, onClick: () => game.player.eat(index) })
    }
    if (firemakingDefs[slot.itemId]) {
      options.push({ label: `Light ${def.name}`, onClick: () => game.player.lightFire(slot.itemId) })
    }
    if (cookingRecipes[slot.itemId]) {
      options.push({ label: `Cook ${def.name}`, onClick: () => cook(slot.itemId) })
    }
    options.push({ label: `Drop ${def.name}`, onClick: () => game.player.drop(index) })
    options.push({ label: `Examine ${def.name}`, onClick: () => store.push(def.examine) })

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
    <div className="inv-panel">
      <div className="item-grid inv-grid">
        {slots.map((slot, index) =>
          slot ? (
            <button
              type="button"
              key={index}
              className="item-slot filled"
              style={{ background: itemColor(slot.itemId) }}
              title={getItemDef(slot.itemId).name}
              onClick={() => defaultAction(index)}
              onContextMenu={(e) => openMenu(e, index)}
            >
              <span className="item-slot-name">{getItemDef(slot.itemId).name}</span>
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
