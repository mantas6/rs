import { herbCleaningRecipes, potionRecipes, unfinishedPotionRecipes } from '../../content/recipes'
import type { HerbCleaningDef, PotionRecipeDef, UnfinishedPotionDef } from '../../content/types'
import type { Game } from '../core/game'
import type { Player, PlayerAction } from '../entities/player'

/** Why a herblore attempt failed to start or was interrupted. */
export type HerbloreFailReason = 'level_too_low' | 'missing_ingredient'

// Herblore events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted once per grimy herb cleaned (the grimy herb is already consumed). */
    herbCleaned: { grimyItemId: string; cleanItemId: string }
    /** Emitted once per unfinished potion mixed (the inputs are already consumed). */
    unfinishedPotionMixed: { unfinishedItemId: string }
    /** Emitted once per finished potion mixed (the inputs are already consumed). */
    potionMixed: { potionItemId: string }
  }
}

/** Ticks per herblore operation (a short repeating mixing animation). */
export const HERBLORE_INTERVAL_TICKS = 2

/**
 * Herb-cleaning recipe lookup for engine code. Content stays data-only; this
 * is the engine's typed gateway into the record (mirrors itemRegistry).
 */
export function getHerbCleaningRecipe(grimyItemId: string): HerbCleaningDef {
  const def = herbCleaningRecipes[grimyItemId]
  if (!def) throw new Error(`Unknown herb cleaning recipe for grimy item id: ${grimyItemId}`)
  return def
}

/**
 * Unfinished-potion recipe lookup for engine code. Content stays data-only;
 * this is the engine's typed gateway into the record (mirrors itemRegistry).
 */
export function getUnfinishedPotionRecipe(unfinishedItemId: string): UnfinishedPotionDef {
  const def = unfinishedPotionRecipes[unfinishedItemId]
  if (!def) {
    throw new Error(`Unknown unfinished potion recipe for item id: ${unfinishedItemId}`)
  }
  return def
}

/**
 * Finished-potion recipe lookup for engine code. Content stays data-only;
 * this is the engine's typed gateway into the record (mirrors itemRegistry).
 */
export function getPotionRecipe(potionItemId: string): PotionRecipeDef {
  const def = potionRecipes[potionItemId]
  if (!def) throw new Error(`Unknown potion recipe for item id: ${potionItemId}`)
  return def
}

/**
 * Validate that `player` may clean `recipe` right now. Returns the failure
 * reason, or null when cleaning may proceed. Uses the CURRENT (boostable)
 * herblore level for the requirement, like OSRS.
 */
export function validateClean(player: Player, recipe: HerbCleaningDef): HerbloreFailReason | null {
  if (player.skills.getCurrentLevel('herblore') < recipe.levelRequired) return 'level_too_low'
  if (!player.inventory.has(recipe.grimyItemId)) return 'missing_ingredient'
  return null
}

/**
 * Validate that `player` may mix `recipe` (an unfinished potion) right now.
 * Returns the failure reason, or null when mixing may proceed. Making an
 * unfinished potion has no level requirement in OSRS.
 */
export function validateMixUnfinished(
  player: Player,
  recipe: UnfinishedPotionDef,
): HerbloreFailReason | null {
  if (!player.inventory.has(recipe.herbItemId) || !player.inventory.has(recipe.vialItemId)) {
    return 'missing_ingredient'
  }
  return null
}

/**
 * Validate that `player` may mix `recipe` (a finished potion) right now.
 * Returns the failure reason, or null when mixing may proceed. Uses the
 * CURRENT (boostable) herblore level for the requirement, like OSRS.
 */
export function validateMixPotion(
  player: Player,
  recipe: PotionRecipeDef,
): HerbloreFailReason | null {
  if (player.skills.getCurrentLevel('herblore') < recipe.levelRequired) return 'level_too_low'
  if (
    !player.inventory.has(recipe.unfinishedItemId) ||
    !player.inventory.has(recipe.secondaryItemId)
  ) {
    return 'missing_ingredient'
  }
  return null
}

/**
 * Tick-driven cleaning of grimy herbs into clean herbs.
 *
 * Started via `player.clean(grimyItemId)`, which validates and sets this
 * action (no walking — herbs are cleaned from the inventory, like sewing
 * leather). Every HERBLORE_INTERVAL_TICKS action ticks: re-validate, consume
 * one grimy herb, grant the clean herb plus xp. Continues until the grimy
 * herbs run out or the player is interrupted.
 */
export class CleanAction implements PlayerAction {
  readonly kind = 'herblore'
  /** Cleaning is done on the player's own tile — no facing target. */
  readonly targetPosition = null

  private ticksUntilClean = HERBLORE_INTERVAL_TICKS

  constructor(private readonly recipe: HerbCleaningDef) {}

  onTick(game: Game): boolean {
    const { player, events } = game
    const recipe = this.recipe

    const reason = validateClean(player, recipe)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    this.ticksUntilClean--
    if (this.ticksUntilClean > 0) return true
    this.ticksUntilClean = HERBLORE_INTERVAL_TICKS

    player.inventory.remove(recipe.grimyItemId)
    player.inventory.add(recipe.cleanItemId)
    player.skills.addXp('herblore', recipe.xp)
    events.emit('herbCleaned', {
      grimyItemId: recipe.grimyItemId,
      cleanItemId: recipe.cleanItemId,
    })

    // Continue only while another grimy herb remains to clean.
    return player.inventory.has(recipe.grimyItemId)
  }
}

/**
 * Tick-driven mixing of clean herbs and vials of water into unfinished
 * potions.
 *
 * Started via `player.mixUnfinished(unfinishedItemId)`, which validates and
 * sets this action (no walking, like cleaning). Every HERBLORE_INTERVAL_TICKS
 * action ticks: re-validate, consume one clean herb and one vial of water,
 * grant the unfinished potion. Grants no xp (like OSRS). Continues until an
 * ingredient runs out or the player is interrupted.
 */
export class MixUnfinishedAction implements PlayerAction {
  readonly kind = 'herblore'
  readonly targetPosition = null

  private ticksUntilMix = HERBLORE_INTERVAL_TICKS

  constructor(private readonly recipe: UnfinishedPotionDef) {}

  onTick(game: Game): boolean {
    const { player, events } = game
    const recipe = this.recipe

    const reason = validateMixUnfinished(player, recipe)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    this.ticksUntilMix--
    if (this.ticksUntilMix > 0) return true
    this.ticksUntilMix = HERBLORE_INTERVAL_TICKS

    player.inventory.remove(recipe.herbItemId)
    player.inventory.remove(recipe.vialItemId)
    player.inventory.add(recipe.unfinishedItemId)
    events.emit('unfinishedPotionMixed', { unfinishedItemId: recipe.unfinishedItemId })

    // Continue only while another herb + vial pair remains.
    return validateMixUnfinished(player, recipe) === null
  }
}

/**
 * Tick-driven mixing of unfinished potions and secondaries into finished
 * potions.
 *
 * Started via `player.mixPotion(potionItemId)`, which validates and sets this
 * action (no walking, like cleaning). Every HERBLORE_INTERVAL_TICKS action
 * ticks: re-validate, consume one unfinished potion and one secondary, grant
 * the finished potion plus xp. Continues until an ingredient runs out or the
 * player is interrupted.
 */
export class MixPotionAction implements PlayerAction {
  readonly kind = 'herblore'
  readonly targetPosition = null

  private ticksUntilMix = HERBLORE_INTERVAL_TICKS

  constructor(private readonly recipe: PotionRecipeDef) {}

  onTick(game: Game): boolean {
    const { player, events } = game
    const recipe = this.recipe

    const reason = validateMixPotion(player, recipe)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    this.ticksUntilMix--
    if (this.ticksUntilMix > 0) return true
    this.ticksUntilMix = HERBLORE_INTERVAL_TICKS

    player.inventory.remove(recipe.unfinishedItemId)
    player.inventory.remove(recipe.secondaryItemId)
    player.inventory.add(recipe.potionItemId)
    player.skills.addXp('herblore', recipe.xp)
    events.emit('potionMixed', { potionItemId: recipe.potionItemId })

    // Continue only while another unfinished + secondary pair remains.
    return validateMixPotion(player, recipe) === null
  }
}
