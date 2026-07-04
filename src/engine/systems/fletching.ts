import { fletchingRecipes } from '../../content/recipes'
import type { FletchingRecipeDef } from '../../content/types'
import type { Game } from '../core/game'
import type { Player, PlayerAction } from '../entities/player'

/** Why a fletch (carve) attempt failed to start or was interrupted. */
export type FletchingFailReason = 'level_too_low' | 'missing_ingredient' | 'missing_tool'

// Fletching events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted once per carve (the log is already consumed). */
    itemFletched: { productItemId: string; quantity: number }
  }
}

/** Item required in the inventory to carve any log (never consumed). */
export const KNIFE_ITEM_ID = 'knife'

/** Ticks per log carved (a short repeating carving animation). */
export const FLETCH_INTERVAL_TICKS = 3

/**
 * Fletching recipe lookup for engine code. Content stays data-only; this is
 * the engine's typed gateway into the record (mirrors itemRegistry).
 */
export function getFletchingRecipe(productItemId: string): FletchingRecipeDef {
  const def = fletchingRecipes[productItemId]
  if (!def) throw new Error(`Unknown fletching recipe for product item id: ${productItemId}`)
  return def
}

/**
 * Validate that `player` may carve `recipe` right now. Returns the failure
 * reason, or null when carving may proceed. Uses the CURRENT (boostable)
 * fletching level for the requirement, like OSRS.
 */
export function validateFletch(
  player: Player,
  recipe: FletchingRecipeDef,
): FletchingFailReason | null {
  if (!player.inventory.has(KNIFE_ITEM_ID)) return 'missing_tool'
  if (player.skills.getCurrentLevel('fletching') < recipe.levelRequired) return 'level_too_low'
  if (!player.inventory.has(recipe.logItemId)) return 'missing_ingredient'
  return null
}

/**
 * Tick-driven carving of logs into fletching products.
 *
 * Started via `player.fletch(productItemId)`, which validates and sets this
 * action (no walking — carving is done from the inventory, like sewing
 * leather). Every FLETCH_INTERVAL_TICKS action ticks: re-validate, consume
 * one log, grant `productQuantity` of the product plus xp. The knife is
 * never consumed. Continues until the logs run out or the player is
 * interrupted.
 */
export class FletchAction implements PlayerAction {
  readonly kind = 'fletching'
  /** Carving is done on the player's own tile — no facing target. */
  readonly targetPosition = null

  private ticksUntilFletch = FLETCH_INTERVAL_TICKS

  constructor(private readonly recipe: FletchingRecipeDef) {}

  onTick(game: Game): boolean {
    const { player, events } = game
    const recipe = this.recipe

    const reason = validateFletch(player, recipe)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    this.ticksUntilFletch--
    if (this.ticksUntilFletch > 0) return true
    this.ticksUntilFletch = FLETCH_INTERVAL_TICKS

    player.inventory.remove(recipe.logItemId)
    player.inventory.add(recipe.productItemId, recipe.productQuantity)
    player.skills.addXp('fletching', recipe.xp)
    events.emit('itemFletched', {
      productItemId: recipe.productItemId,
      quantity: recipe.productQuantity,
    })

    // Continue only while another log remains to carve.
    return player.inventory.has(recipe.logItemId)
  }
}
