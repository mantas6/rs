import { craftingRecipes, tanningRecipes } from '../../content/recipes'
import type { CraftingRecipeDef, TanningRecipeDef } from '../../content/types'
import type { Game } from '../core/game'
import type { Player, PlayerAction } from '../entities/player'
import { chebyshev, type Vec2 } from '../world/vec2'
import { WorldObject } from '../world/worldObject'

/** Why a tan attempt failed to start or was interrupted. */
export type TanningFailReason = 'missing_ingredient' | 'invalid_source'

/** Why a sew (craft) attempt failed to start or was interrupted. */
export type CraftingFailReason = 'level_too_low' | 'missing_ingredient' | 'missing_tool'

/** Something hides can be tanned on: a tannery world object. */
export type TanningSource = WorldObject

// Crafting events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted once per hide tanned (the hide is already consumed). */
    hideTanned: { hideItemId: string; leatherItemId: string }
    /** Emitted once per item sewn (the leather + thread are already consumed). */
    itemCrafted: { productItemId: string }
  }
}

/** Item required in the inventory to sew any leather item (never consumed). */
export const NEEDLE_ITEM_ID = 'needle'

/** Thread item consumed while sewing leather items. */
export const THREAD_ITEM_ID = 'thread'

/** Ticks per hide tanned (a short repeating tannery animation). */
export const TAN_INTERVAL_TICKS = 3

/** Ticks per item sewn (a short repeating stitching animation). */
export const CRAFT_INTERVAL_TICKS = 3

/**
 * Tanning recipe lookup for engine code. Content stays data-only; this is
 * the engine's typed gateway into the record (mirrors itemRegistry).
 */
export function getTanningRecipe(hideItemId: string): TanningRecipeDef {
  const def = tanningRecipes[hideItemId]
  if (!def) throw new Error(`Unknown tanning recipe for hide item id: ${hideItemId}`)
  return def
}

/**
 * Crafting (sewing) recipe lookup for engine code. Content stays data-only;
 * this is the engine's typed gateway into the record (mirrors itemRegistry).
 */
export function getCraftingRecipe(productItemId: string): CraftingRecipeDef {
  const def = craftingRecipes[productItemId]
  if (!def) throw new Error(`Unknown crafting recipe for product item id: ${productItemId}`)
  return def
}

/** True when `source` is a tannery that hides can be tanned on. */
export function isValidTanningSource(source: TanningSource): boolean {
  return source.def.tanningSource === true
}

/**
 * Validate that `player` may tan `recipe` on `source` right now. Returns the
 * failure reason, or null when tanning may proceed. Tanning has no level
 * requirement (like OSRS), only a hide to tan and a valid tannery.
 */
export function validateTan(
  player: Player,
  recipe: TanningRecipeDef,
  source: TanningSource,
): TanningFailReason | null {
  if (!isValidTanningSource(source)) return 'invalid_source'
  if (!player.inventory.has(recipe.hideItemId)) return 'missing_ingredient'
  return null
}

/**
 * Tick-driven tanning at a tannery.
 *
 * Started via `player.tan(hideItemId, source)`, which validates, queues a
 * walk to a tile adjacent to the tannery, and sets this action (walk-then-
 * act, same as smelting). Every TAN_INTERVAL_TICKS action ticks: consume one
 * hide and produce one leather (no xp, never fails — like OSRS). Continues
 * until the hides run out, the source becomes invalid, or the player is
 * interrupted.
 */
export class TanAction implements PlayerAction {
  readonly kind = 'crafting'

  private ticksUntilTan = TAN_INTERVAL_TICKS

  constructor(
    private readonly recipe: TanningRecipeDef,
    private readonly source: TanningSource,
  ) {}

  get targetPosition(): Readonly<Vec2> {
    return this.source.position
  }

  onTick(game: Game): boolean {
    const { player, events } = game
    const recipe = this.recipe

    // Player.update only ticks actions while idle, so if we are not adjacent
    // here the walk was interrupted (stop()) — end silently. Tanneries block
    // movement, so the player is always exactly one tile away when tanning.
    if (chebyshev(player.position, this.source.position) > 1) return false

    const reason = validateTan(player, recipe, this.source)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    this.ticksUntilTan--
    if (this.ticksUntilTan > 0) return true
    this.ticksUntilTan = TAN_INTERVAL_TICKS

    player.inventory.remove(recipe.hideItemId)
    player.inventory.add(recipe.leatherItemId)
    events.emit('hideTanned', {
      hideItemId: recipe.hideItemId,
      leatherItemId: recipe.leatherItemId,
    })

    return player.inventory.has(recipe.hideItemId)
  }
}

/** True when `player` holds everything a single sew of `recipe` needs. */
function canSew(player: Player, recipe: CraftingRecipeDef): boolean {
  return (
    player.inventory.has(NEEDLE_ITEM_ID) &&
    player.inventory.has(recipe.leatherItemId, recipe.leatherRequired) &&
    player.inventory.has(THREAD_ITEM_ID, recipe.threadRequired)
  )
}

/**
 * Validate that `player` may sew `recipe` right now. Returns the failure
 * reason, or null when sewing may proceed. Uses the CURRENT (boostable)
 * crafting level for the requirement, like OSRS.
 */
export function validateCraft(
  player: Player,
  recipe: CraftingRecipeDef,
): CraftingFailReason | null {
  if (!player.inventory.has(NEEDLE_ITEM_ID)) return 'missing_tool'
  if (player.skills.getCurrentLevel('crafting') < recipe.levelRequired) return 'level_too_low'
  if (
    !player.inventory.has(recipe.leatherItemId, recipe.leatherRequired) ||
    !player.inventory.has(THREAD_ITEM_ID, recipe.threadRequired)
  ) {
    return 'missing_ingredient'
  }
  return null
}

/**
 * Tick-driven sewing of leather into equipment.
 *
 * Started via `player.craft(productItemId)`, which validates and sets this
 * action (no walking — sewing is done from the inventory, like lighting a
 * fire). Every CRAFT_INTERVAL_TICKS action ticks: re-validate, consume the
 * leather + thread, grant the product plus xp. The needle is never consumed.
 * Continues until the materials run out or the player is interrupted.
 */
export class CraftAction implements PlayerAction {
  readonly kind = 'crafting'
  /** Sewing is done on the player's own tile — no facing target. */
  readonly targetPosition = null

  private ticksUntilCraft = CRAFT_INTERVAL_TICKS

  constructor(private readonly recipe: CraftingRecipeDef) {}

  onTick(game: Game): boolean {
    const { player, events } = game
    const recipe = this.recipe

    const reason = validateCraft(player, recipe)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    this.ticksUntilCraft--
    if (this.ticksUntilCraft > 0) return true
    this.ticksUntilCraft = CRAFT_INTERVAL_TICKS

    player.inventory.remove(recipe.leatherItemId, recipe.leatherRequired)
    player.inventory.remove(THREAD_ITEM_ID, recipe.threadRequired)
    player.inventory.add(recipe.productItemId)
    player.skills.addXp('crafting', recipe.xp)
    events.emit('itemCrafted', { productItemId: recipe.productItemId })

    // Continue only while enough materials remain for another item.
    return canSew(player, recipe)
  }
}
