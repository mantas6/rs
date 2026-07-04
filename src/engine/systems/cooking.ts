import { cookingRecipes } from '../../content/recipes'
import type { CookingRecipeDef } from '../../content/types'
import type { Game } from '../core/game'
import type { Player, PlayerAction } from '../entities/player'
import { chebyshev, type Vec2 } from '../world/vec2'
import { WorldObject } from '../world/worldObject'
import { Fire } from './firemaking'

/** Why a cook attempt failed to start or was interrupted. */
export type CookingFailReason = 'level_too_low' | 'missing_ingredient' | 'invalid_source'

/** Something food can be cooked on: a lit fire or a cooking range object. */
export type CookingSource = Fire | WorldObject

// Cooking events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /**
     * Emitted per cook attempt. `burnt` = true means `resultItemId` is the
     * burnt item and no xp was granted.
     */
    itemCooked: { rawItemId: string; resultItemId: string; burnt: boolean }
  }
}

/** Ticks per cooked item (OSRS cooks one item every 4 ticks). */
export const COOK_INTERVAL_TICKS = 4

/** Maximum burn chance, applied at the recipe's required level. */
export const COOK_BURN_CHANCE_MAX = 0.5

/**
 * Cooking recipe lookup for engine code. Content stays data-only; this is
 * the engine's typed gateway into the record (mirrors itemRegistry).
 */
export function getCookingRecipe(rawItemId: string): CookingRecipeDef {
  const def = cookingRecipes[rawItemId]
  if (!def) throw new Error(`Unknown cooking recipe for raw item id: ${rawItemId}`)
  return def
}

/**
 * Burn chance at `level`: interpolates linearly from COOK_BURN_CHANCE_MAX
 * at `levelRequired` down to 0 at `burnStopLevel`, clamped so food never
 * burns at (or above) the stop level.
 *
 * TODO: ranges could burn slightly less than fires; for now both sources
 * use the same chance.
 */
export function cookBurnChance(recipe: CookingRecipeDef, level: number): number {
  const { levelRequired, burnStopLevel } = recipe
  if (level >= burnStopLevel) return 0
  const span = Math.max(1, burnStopLevel - levelRequired)
  const chance = (COOK_BURN_CHANCE_MAX * (burnStopLevel - level)) / span
  return Math.min(COOK_BURN_CHANCE_MAX, Math.max(0, chance))
}

/** True when `source` can currently cook food (burning fire or a range). */
export function isValidCookingSource(source: CookingSource): boolean {
  if (source instanceof Fire) return !source.expired
  return source.def.cookingSource === true
}

/**
 * Validate that `player` may cook `recipe` on `source` right now. Returns
 * the failure reason, or null when cooking may proceed. Uses the CURRENT
 * (boostable) cooking level for the requirement, like OSRS.
 */
export function validateCook(
  player: Player,
  recipe: CookingRecipeDef,
  source: CookingSource,
): CookingFailReason | null {
  if (!isValidCookingSource(source)) return 'invalid_source'
  if (player.skills.getCurrentLevel('cooking') < recipe.levelRequired) return 'level_too_low'
  if (!player.inventory.has(recipe.rawItemId)) return 'missing_ingredient'
  return null
}

/**
 * Tick-driven cooking on a fire or range.
 *
 * Started via `player.cook(rawItemId, source)`, which validates, queues a
 * walk to a tile adjacent to the source, and sets this action (walk-then-act,
 * same as gathering). Every COOK_INTERVAL_TICKS action ticks: consume one
 * raw item and roll `cookBurnChance` — success grants the cooked item + xp,
 * a burn grants the burnt item and no xp. Continues until the raw items run
 * out, the source expires, or the player is interrupted.
 */
export class CookAction implements PlayerAction {
  readonly kind = 'cooking'

  private ticksUntilCook = COOK_INTERVAL_TICKS

  constructor(
    private readonly recipe: CookingRecipeDef,
    private readonly source: CookingSource,
  ) {}

  get targetPosition(): Readonly<Vec2> {
    return this.source.position
  }

  onTick(game: Game): boolean {
    const { player, events, rng } = game
    const recipe = this.recipe

    // Player.update only ticks actions while idle, so if we are not at the
    // source here the walk was interrupted (stop()) — end silently. Distance
    // 0 is allowed: fires do not block, so the player may stand on one.
    if (chebyshev(player.position, this.source.position) > 1) return false

    const reason = validateCook(player, recipe, this.source)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    this.ticksUntilCook--
    if (this.ticksUntilCook > 0) return true
    this.ticksUntilCook = COOK_INTERVAL_TICKS

    const level = player.skills.getCurrentLevel('cooking')
    const burnt = rng.chance(cookBurnChance(recipe, level))
    const resultItemId = burnt ? recipe.burntItemId : recipe.cookedItemId
    player.inventory.remove(recipe.rawItemId)
    player.inventory.add(resultItemId)
    if (!burnt) player.skills.addXp('cooking', recipe.xp)
    events.emit('itemCooked', { rawItemId: recipe.rawItemId, resultItemId, burnt })

    return player.inventory.has(recipe.rawItemId)
  }
}
