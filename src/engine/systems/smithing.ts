import { smeltingRecipes } from '../../content/recipes'
import type { SmeltingRecipeDef } from '../../content/types'
import type { Game } from '../core/game'
import type { Player, PlayerAction } from '../entities/player'
import { chebyshev, type Vec2 } from '../world/vec2'
import { WorldObject } from '../world/worldObject'

/** Why a smelt attempt failed to start or was interrupted. */
export type SmeltingFailReason = 'level_too_low' | 'missing_ingredient' | 'invalid_source'

/** Something ore can be smelted on: a furnace world object. */
export type SmeltingSource = WorldObject

// Smithing events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /**
     * Emitted per smelt attempt. `success` = false means the ore was
     * consumed but no bar or xp was produced (e.g. a failed iron smelt).
     */
    oreSmelted: { barItemId: string; success: boolean }
  }
}

/** Ticks per smelt attempt (OSRS smelts on a short repeating animation). */
export const SMELT_INTERVAL_TICKS = 4

/**
 * Smelting recipe lookup for engine code. Content stays data-only; this is
 * the engine's typed gateway into the record (mirrors itemRegistry).
 */
export function getSmeltingRecipe(barItemId: string): SmeltingRecipeDef {
  const def = smeltingRecipes[barItemId]
  if (!def) throw new Error(`Unknown smelting recipe for bar item id: ${barItemId}`)
  return def
}

/** True when `source` is a furnace that can currently smelt ore. */
export function isValidSmeltingSource(source: SmeltingSource): boolean {
  return source.def.smeltingSource === true
}

/**
 * Validate that `player` may smelt `recipe` on `source` right now. Returns
 * the failure reason, or null when smelting may proceed. Uses the CURRENT
 * (boostable) smithing level for the requirement, like OSRS, and requires
 * every ore input to be present in sufficient quantity.
 */
export function validateSmelt(
  player: Player,
  recipe: SmeltingRecipeDef,
  source: SmeltingSource,
): SmeltingFailReason | null {
  if (!isValidSmeltingSource(source)) return 'invalid_source'
  if (player.skills.getCurrentLevel('smithing') < recipe.levelRequired) return 'level_too_low'
  for (const { itemId, quantity } of recipe.inputs) {
    if (!player.inventory.has(itemId, quantity)) return 'missing_ingredient'
  }
  return null
}

/** True when `player` still holds every ore input of `recipe`. */
function hasAllInputs(player: Player, recipe: SmeltingRecipeDef): boolean {
  return recipe.inputs.every(({ itemId, quantity }) => player.inventory.has(itemId, quantity))
}

/**
 * Tick-driven smelting at a furnace.
 *
 * Started via `player.smelt(barItemId, source)`, which validates, queues a
 * walk to a tile adjacent to the furnace, and sets this action (walk-then-
 * act, same as gathering/cooking). Every SMELT_INTERVAL_TICKS action ticks:
 * consume all ore inputs, then roll `successChance`. On success grant the
 * bar + xp; on failure the ore is still consumed and no xp is granted (like
 * OSRS iron). Continues until the ore runs out, the source becomes invalid,
 * or the player is interrupted.
 */
export class SmeltAction implements PlayerAction {
  readonly kind = 'smithing'

  private ticksUntilSmelt = SMELT_INTERVAL_TICKS

  constructor(
    private readonly recipe: SmeltingRecipeDef,
    private readonly source: SmeltingSource,
  ) {}

  get targetPosition(): Readonly<Vec2> {
    return this.source.position
  }

  onTick(game: Game): boolean {
    const { player, events, rng } = game
    const recipe = this.recipe

    // Player.update only ticks actions while idle, so if we are not adjacent
    // here the walk was interrupted (stop()) — end silently. Furnaces block
    // movement, so the player is always exactly one tile away when smelting.
    if (chebyshev(player.position, this.source.position) > 1) return false

    const reason = validateSmelt(player, recipe, this.source)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    this.ticksUntilSmelt--
    if (this.ticksUntilSmelt > 0) return true
    this.ticksUntilSmelt = SMELT_INTERVAL_TICKS

    // Ore is consumed up front — a failed smelt still burns it, like OSRS.
    for (const { itemId, quantity } of recipe.inputs) {
      player.inventory.remove(itemId, quantity)
    }
    const success = rng.chance(recipe.successChance)
    if (success) {
      player.inventory.add(recipe.barItemId)
      player.skills.addXp('smithing', recipe.xp)
    }
    events.emit('oreSmelted', { barItemId: recipe.barItemId, success })

    return hasAllInputs(player, recipe)
  }
}
