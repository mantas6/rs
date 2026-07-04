import { useRef, useState } from 'react'
import type { DragEvent, MouseEvent } from 'react'
import { cookingRecipes, firemakingDefs, smeltingRecipes, smithingRecipes } from '../../content/recipes'
import type { AnvilSource, CookingSource, Game, SmeltingSource } from '../../engine'
import { chebyshev, getItemDef } from '../../engine'
import { ContextMenu, type MenuOption, type MenuState } from '../ContextMenu'
import { ItemIcon } from '../icons/ItemIcon'
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

/** Nearest furnace to smelt at, or null. */
function nearestSmeltingSource(game: Game): SmeltingSource | null {
  let best: SmeltingSource | null = null
  let bestDistance = Infinity
  for (const object of game.world.objects) {
    if (object.def.smeltingSource !== true) continue
    const distance = chebyshev(game.player.position, object.position)
    if (distance < bestDistance) {
      bestDistance = distance
      best = object
    }
  }
  return best
}

/** The bar an ore smelts into (first recipe listing it as an input), or null. */
function barForOre(itemId: string): string | null {
  for (const recipe of Object.values(smeltingRecipes)) {
    if (recipe.inputs.some((input) => input.itemId === itemId)) return recipe.barItemId
  }
  return null
}

/** Nearest anvil to forge at, or null. */
function nearestAnvilSource(game: Game): AnvilSource | null {
  let best: AnvilSource | null = null
  let bestDistance = Infinity
  for (const object of game.world.objects) {
    if (object.def.anvilSource !== true) continue
    const distance = chebyshev(game.player.position, object.position)
    if (distance < bestDistance) {
      bestDistance = distance
      best = object
    }
  }
  return best
}

/**
 * The first product forgeable from `barItemId` that the player has the level
 * for and enough bars to make, or null. Lets a bar in the backpack offer a
 * sensible default "Smith" action.
 */
function productForBar(game: Game, barItemId: string): string | null {
  for (const recipe of Object.values(smithingRecipes)) {
    if (recipe.barItemId !== barItemId) continue
    if (game.player.skills.getCurrentLevel('smithing') < recipe.levelRequired) continue
    if (game.player.inventory.has(recipe.barItemId, recipe.barsRequired)) return recipe.productItemId
  }
  return null
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
  const [dragOver, setDragOver] = useState<number | null>(null)
  const slots = game.player.inventory.slots

  // Slot the drag started from, and a guard so the click fired at the end of a
  // drag gesture does not also run the item's default action.
  const dragFrom = useRef<number | null>(null)
  const didDrag = useRef(false)

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

  function smelt(barItemId: string): void {
    const source = nearestSmeltingSource(game)
    if (source === null) store.push('There is no furnace to smelt that at.')
    else game.player.smelt(barItemId, source)
  }

  function forge(productItemId: string): void {
    const source = nearestAnvilSource(game)
    if (source === null) store.push('There is no anvil to smith that at.')
    else game.player.forge(productItemId, source)
  }

  function defaultAction(index: number): void {
    const slot = slots[index]
    if (!slot) return
    const def = getItemDef(slot.itemId)
    const bar = barForOre(slot.itemId)
    const product = productForBar(game, slot.itemId)
    if (def.equipment) equip(index)
    else if (def.drink) game.player.drink(index)
    else if (def.healAmount !== undefined) game.player.eat(index)
    else if (firemakingDefs[slot.itemId]) game.player.lightFire(slot.itemId)
    else if (cookingRecipes[slot.itemId]) cook(slot.itemId)
    else if (bar) smelt(bar)
    else if (product) forge(product)
    else if (def.buryXp !== undefined) game.player.bury(index)
    else store.push(def.examine)
    refresh()
  }

  function handleClick(index: number): void {
    // A drag gesture ends with a click on some browsers; ignore it so
    // rearranging items never triggers the item's default action.
    if (didDrag.current) {
      didDrag.current = false
      return
    }
    defaultAction(index)
  }

  function onDragStart(e: DragEvent, index: number): void {
    dragFrom.current = index
    didDrag.current = false
    setMenu(null)
    e.dataTransfer.effectAllowed = 'move'
    // Firefox requires data to be set for a drag to start.
    e.dataTransfer.setData('text/plain', String(index))
  }

  function onDragOver(e: DragEvent, index: number): void {
    if (dragFrom.current === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOver !== index) setDragOver(index)
  }

  function onDrop(e: DragEvent, index: number): void {
    e.preventDefault()
    const from = dragFrom.current
    dragFrom.current = null
    setDragOver(null)
    if (from === null || from === index) return
    didDrag.current = true
    game.player.inventory.swap(from, index)
    refresh()
  }

  function onDragEnd(): void {
    dragFrom.current = null
    setDragOver(null)
  }

  function openMenu(e: MouseEvent, index: number): void {
    e.preventDefault()
    const slot = slots[index]
    if (!slot) return
    const def = getItemDef(slot.itemId)

    const options: MenuOption[] = []
    if (def.equipment) options.push({ label: `Equip ${def.name}`, onClick: () => equip(index) })
    if (def.drink) {
      options.push({ label: `Drink ${def.name}`, onClick: () => game.player.drink(index) })
    }
    if (def.healAmount !== undefined) {
      options.push({ label: `Eat ${def.name}`, onClick: () => game.player.eat(index) })
    }
    if (firemakingDefs[slot.itemId]) {
      options.push({ label: `Light ${def.name}`, onClick: () => game.player.lightFire(slot.itemId) })
    }
    if (cookingRecipes[slot.itemId]) {
      options.push({ label: `Cook ${def.name}`, onClick: () => cook(slot.itemId) })
    }
    const bar = barForOre(slot.itemId)
    if (bar) {
      options.push({ label: `Smelt ${def.name}`, onClick: () => smelt(bar) })
    }
    const product = productForBar(game, slot.itemId)
    if (product) {
      options.push({ label: `Smith ${def.name}`, onClick: () => forge(product) })
    }
    if (def.buryXp !== undefined) {
      options.push({ label: `Bury ${def.name}`, onClick: () => game.player.bury(index) })
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
              className={`item-slot filled${dragOver === index ? ' drag-over' : ''}`}
              title={getItemDef(slot.itemId).name}
              draggable
              onClick={() => handleClick(index)}
              onContextMenu={(e) => openMenu(e, index)}
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
            >
              <ItemIcon itemId={slot.itemId} />
              {slot.quantity > 1 && <span className="item-slot-qty">{slot.quantity}</span>}
            </button>
          ) : (
            <div
              key={index}
              className={`item-slot${dragOver === index ? ' drag-over' : ''}`}
              onContextMenu={(e) => e.preventDefault()}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={(e) => onDrop(e, index)}
            />
          ),
        )}
      </div>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
