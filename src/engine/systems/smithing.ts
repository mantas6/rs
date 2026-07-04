import { smeltingRecipes, smithingRecipes } from '../../content/recipes'
import type { SmeltingRecipeDef, SmithingRecipeDef } from '../../content/types'
import type { Game } from '../core/game'
import type { Player, PlayerAction } from '../entities/player'
import { chebyshev, type Vec2 } from '../world/vec2'
import { WorldObject } from '../world/worldObject'

/** Why a smelt attempt failed to start or was interrupted. */
export type SmeltingFailReason = 'level_too_low' | 'missing_ingredient' | 'invalid_source'

/** Why a forge attempt failed to start or was interrupted (same set as smelting). */
export type ForgeFailReason = SmeltingFailReason

/** Something ore can be smelted on: a furnace world object. */
export type SmeltingSource = WorldObject

/** Something bars can be forged on: an anvil world object. */
export type AnvilSource = WorldObject

// Smithing events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /**
     * Emitted per smelt attempt. `success` = false means the ore was
     * consumed but no bar or xp was produced (e.g. a failed iron smelt).
     */
    oreSmelted: { barItemId: string; success: boolean }
    /** Emitted once per successful forge (the bars are already consumed). */
    barForged: { productItemId: string }
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

/** Ticks per forge attempt (an anvil hammering animation, like OSRS). */
export const FORGE_INTERVAL_TICKS = 5

/**
 * Forging recipe lookup for engine code. Content stays data-only; this is
 * the engine's typed gateway into the record (mirrors getSmeltingRecipe).
 */
export function getSmithingRecipe(productItemId: string): SmithingRecipeDef {
  const def = smithingRecipes[productItemId]
  if (!def) throw new Error(`Unknown smithing recipe for product item id: ${productItemId}`)
  return def
}

/** True when `source` is an anvil that bars can be forged on. */
export function isValidAnvilSource(source: AnvilSource): boolean {
  return source.def.anvilSource === true
}

/**
 * Validate that `player` may forge `recipe` on `source` right now. Returns
 * the failure reason, or null when forging may proceed. Uses the CURRENT
 * (boostable) smithing level for the requirement, like OSRS, and requires
 * enough bars in the inventory for one forge.
 */
export function validateForge(
  player: Player,
  recipe: SmithingRecipeDef,
  source: AnvilSource,
): ForgeFailReason | null {
  if (!isValidAnvilSource(source)) return 'invalid_source'
  if (player.skills.getCurrentLevel('smithing') < recipe.levelRequired) return 'level_too_low'
  if (!player.inventory.has(recipe.barItemId, recipe.barsRequired)) return 'missing_ingredient'
  return null
}

/**
 * Tick-driven forging at an anvil.
 *
 * Started via `player.forge(productItemId, source)`, which validates, queues
 * a walk to a tile adjacent to the anvil, and sets this action (walk-then-
 * act, same as smelting). Every FORGE_INTERVAL_TICKS action ticks: consume
 * the bars, grant the product plus xp. Unlike smelting, forging never fails.
 * Continues until the bars run out, the source becomes invalid, or the
 * player is interrupted.
 */
export class ForgeAction implements PlayerAction {
  readonly kind = 'smithing'

  private ticksUntilForge = FORGE_INTERVAL_TICKS

  constructor(
    private readonly recipe: SmithingRecipeDef,
    private readonly source: AnvilSource,
  ) {}

  get targetPosition(): Readonly<Vec2> {
    return this.source.position
  }

  onTick(game: Game): boolean {
    const { player, events } = game
    const recipe = this.recipe

    // Player.update only ticks actions while idle, so if we are not adjacent
    // here the walk was interrupted (stop()) — end silently. Anvils block
    // movement, so the player is always exactly one tile away when forging.
    if (chebyshev(player.position, this.source.position) > 1) return false

    const reason = validateForge(player, recipe, this.source)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    this.ticksUntilForge--
    if (this.ticksUntilForge > 0) return true
    this.ticksUntilForge = FORGE_INTERVAL_TICKS

    player.inventory.remove(recipe.barItemId, recipe.barsRequired)
    player.inventory.add(recipe.productItemId)
    player.skills.addXp('smithing', recipe.xp)
    events.emit('barForged', { productItemId: recipe.productItemId })

    // Continue only while enough bars remain for another forge.
    return player.inventory.has(recipe.barItemId, recipe.barsRequired)
  }
}
