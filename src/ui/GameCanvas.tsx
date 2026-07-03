import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { cookingRecipes } from '../content/recipes'
import type { CookingSource, Game } from '../engine'
import { getItemDef } from '../engine'
import { ContextMenu, type MenuState } from './ContextMenu'
import type { MessageStore } from './messages'
import {
  computeCamera,
  describeTile,
  type Hover,
  npcCombatLevel,
  renderGame,
  tileFromPixel,
  VIEW_H,
  VIEW_W,
} from './renderer'

const GATHER_VERBS: Record<string, string> = {
  woodcutting: 'Chop down',
  mining: 'Mine',
  fishing: 'Net',
}

/** First raw item in the inventory that has a cooking recipe, or null. */
function firstRawItemId(game: Game): string | null {
  for (const slot of game.player.inventory.slots) {
    if (slot && cookingRecipes[slot.itemId]) return slot.itemId
  }
  return null
}

/** Cook the first cookable raw item on `source` (message when none). */
function cookFirstRaw(game: Game, source: CookingSource, store: MessageStore): void {
  const rawItemId = firstRawItemId(game)
  if (rawItemId === null) store.push('You have nothing to cook.')
  else game.player.cook(rawItemId, source)
}

/**
 * The world viewport: a single <canvas> redrawn once per tick (version
 * bump) plus left-click commands and a right-click context menu. All
 * behavior goes through engine command APIs — no game logic here.
 */
export function GameCanvas({
  game,
  version,
  store,
  refresh,
}: {
  game: Game
  version: number
  store: MessageStore
  refresh: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) renderGame(ctx, game, computeCamera(game), hover)
  }, [game, version, hover])

  function tileFromEvent(e: MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    return tileFromPixel(computeCamera(game), e.clientX - rect.left, e.clientY - rect.top)
  }

  function handleMouseMove(e: MouseEvent<HTMLCanvasElement>): void {
    const tile = tileFromEvent(e)
    if (!hover || hover.x !== tile.x || hover.y !== tile.y) setHover(tile)
  }

  /** OSRS-like left-click priority: NPC, node, bank, range, item, walk. */
  function handleClick(e: MouseEvent<HTMLCanvasElement>): void {
    const { x, y } = tileFromEvent(e)
    if (!game.world.inBounds(x, y)) return

    const npc = game.npcs.find((n) => n.alive && n.x === x && n.y === y)
    if (npc) {
      game.player.attack(npc)
      return refresh()
    }
    const node = game.world.nodeAt(x, y)
    if (node) {
      game.player.gather(node)
      return refresh()
    }
    const object = game.world.objectAt(x, y)
    if (object?.def.bank) {
      game.player.openBank(object)
      return refresh()
    }
    if (object?.def.cookingSource) {
      cookFirstRaw(game, object, store)
      return refresh()
    }
    const item = game.groundItems.itemsAt(x, y)[0]
    if (item) {
      game.player.pickUp(item)
      return refresh()
    }
    if (!game.player.walkTo(x, y)) store.push("You can't reach that.")
    refresh()
  }

  function handleContextMenu(e: MouseEvent<HTMLCanvasElement>): void {
    e.preventDefault()
    const { x, y } = tileFromEvent(e)
    if (!game.world.inBounds(x, y)) return

    const options: MenuState['options'] = []
    const examines: MenuState['options'] = []

    for (const npc of game.npcs) {
      if (!npc.alive || npc.x !== x || npc.y !== y) continue
      options.push({
        label: `Attack ${npc.def.name} (level ${npcCombatLevel(npc.def)})`,
        onClick: () => game.player.attack(npc),
      })
      examines.push({
        label: `Examine ${npc.def.name}`,
        onClick: () => store.push(npc.def.examine),
      })
    }

    const node = game.world.nodeAt(x, y)
    if (node) {
      options.push({
        label: `${GATHER_VERBS[node.def.skill]} ${node.def.name}`,
        onClick: () => game.player.gather(node),
      })
    }

    const object = game.world.objectAt(x, y)
    if (object) {
      if (object.def.bank) {
        options.push({
          label: `Bank ${object.def.name}`,
          onClick: () => game.player.openBank(object),
        })
      }
      if (object.def.cookingSource) {
        options.push({
          label: `Cook at ${object.def.name}`,
          onClick: () => cookFirstRaw(game, object, store),
        })
      }
      examines.push({
        label: `Examine ${object.def.name}`,
        onClick: () => store.push(object.def.examine),
      })
    }

    const fire = game.fires.fireAt(x, y)
    if (fire) {
      options.push({ label: 'Cook at Fire', onClick: () => cookFirstRaw(game, fire, store) })
    }

    for (const item of game.groundItems.itemsAt(x, y)) {
      const def = getItemDef(item.itemId)
      const suffix = item.quantity > 1 ? ` (${item.quantity})` : ''
      options.push({ label: `Take ${def.name}${suffix}`, onClick: () => game.player.pickUp(item) })
      examines.push({ label: `Examine ${def.name}`, onClick: () => store.push(def.examine) })
    }

    options.push({
      label: 'Walk here',
      onClick: () => {
        if (!game.player.walkTo(x, y)) store.push("You can't reach that.")
      },
    })

    const withRefresh = [...options, ...examines].map((option) => ({
      label: option.label,
      onClick: () => {
        option.onClick()
        refresh()
      },
    }))
    setMenu({ x: e.clientX, y: e.clientY, options: withRefresh })
  }

  // Keep the hover title in the DOM too, for accessibility/debugging.
  const hoverLabel = hover ? describeTile(game, hover.x, hover.y) : null

  return (
    <div className="game-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={VIEW_W}
        height={VIEW_H}
        title={hoverLabel ?? undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
