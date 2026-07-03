import type { ResourceNodeDef, ToolDef, ToolKind } from '../../content/types'
import type { Game } from '../core/game'
import type { ConsumeFailReason, Player, PlayerAction } from '../entities/player'
import type { ResourceNode } from '../world/resourceNode'
import { chebyshev } from '../world/vec2'
import type { BankFailReason } from './bank'
import type { CombatFailReason } from './combat'
import type { CookingFailReason } from './cooking'
import type { FiremakingFailReason } from './firemaking'
import { getItemDef } from './itemRegistry'
import { MAX_LEVEL } from './skills'

/** Why a gather attempt failed to start or was interrupted. */
export type GatherFailReason =
  | 'level_too_low'
  | 'missing_tool'
  | 'inventory_full'
  | 'node_depleted'

/** Why any player action (gathering, combat, processing, banking) failed. */
export type ActionFailReason =
  | GatherFailReason
  | CombatFailReason
  | FiremakingFailReason
  | CookingFailReason
  | BankFailReason
  | ConsumeFailReason

// Gathering events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when starting or continuing an action fails validation. */
    actionFailed: { reason: ActionFailReason }
    /** Emitted on every successful gather (item + xp already granted). */
    resourceGathered: { nodeId: string; itemId: string; xp: number }
    /** Emitted when a node depletes; it respawns at `respawnAtTick`. */
    nodeDepleted: { nodeId: string; x: number; y: number; respawnAtTick: number }
    /** Emitted when a depleted node becomes gatherable again. */
    nodeRespawned: { nodeId: string; x: number; y: number }
  }
}

/** Per-tool-tier additive success bonus (tier 1 adds nothing). */
export const TOOL_TIER_CHANCE_BONUS = 0.05

/**
 * Best tool of `kind` the player can use: scans the inventory AND the
 * equipped weapon slot, keeps tools whose requiredLevel is met in the
 * node's skill, and returns the highest tier (null when none qualify).
 */
export function findBestTool(
  player: Player,
  kind: ToolKind,
  skillLevel: number,
): ToolDef | null {
  let best: ToolDef | null = null
  const consider = (itemId: string): void => {
    const tool = getItemDef(itemId).tool
    if (!tool || tool.kind !== kind || tool.requiredLevel > skillLevel) return
    if (best === null || tool.tier > best.tier) best = tool
  }
  for (const slot of player.inventory.slots) {
    if (slot) consider(slot.itemId)
  }
  const weapon = player.equipment.get('weapon')
  if (weapon) consider(weapon.itemId)
  return best
}

/**
 * Per-tick success chance: OSRS-style linear interpolation between
 * `chanceLow` (level 1) and `chanceHigh` (level 99), plus a small additive
 * bonus per tool tier above 1 (TOOL_TIER_CHANCE_BONUS each). Clamped to
 * [0, 1]. `toolTier` is 0 when the node needs no tool.
 */
export function gatherSuccessChance(
  def: ResourceNodeDef,
  level: number,
  toolTier: number,
): number {
  const clamped = Math.min(Math.max(level, 1), MAX_LEVEL)
  const base =
    (def.chanceLow * (MAX_LEVEL - clamped) + def.chanceHigh * (clamped - 1)) / (MAX_LEVEL - 1)
  const bonus = Math.max(0, toolTier - 1) * TOOL_TIER_CHANCE_BONUS
  return Math.min(1, Math.max(0, base + bonus))
}

/**
 * Validate that `player` may gather from `node` right now. Returns the
 * failure reason, or null when gathering may proceed. Uses the CURRENT
 * (boostable) skill level for requirements, like OSRS.
 */
export function validateGather(player: Player, node: ResourceNode): GatherFailReason | null {
  const def = node.def
  if (node.depleted) return 'node_depleted'
  const level = player.skills.getCurrentLevel(def.skill)
  if (level < def.levelRequired) return 'level_too_low'
  if (def.requiredToolKind && findBestTool(player, def.requiredToolKind, level) === null) {
    return 'missing_tool'
  }
  if (player.inventory.isFull) return 'inventory_full'
  return null
}

/**
 * Tick-driven gathering at a resource node.
 *
 * Started via `player.gather(node)`, which validates, queues a walk to an
 * adjacent tile, and sets this action. Player.update walks the path first
 * and only ticks the action once movement completes, so "walk then gather"
 * falls out of the existing movement/action interaction — no extra state.
 *
 * Each tick: re-validate, roll success (interpolated chance scaled by tool
 * tier), grant item + xp on success, then roll depletion. The action ends
 * when the node depletes, the inventory fills, validation fails, or the
 * player is no longer adjacent (e.g. stop() was called mid-walk).
 */
export class GatherAction implements PlayerAction {
  constructor(private readonly node: ResourceNode) {}

  onTick(game: Game): boolean {
    const { player, events, rng } = game
    const def = this.node.def

    // Player.update only ticks actions while idle, so if we are not adjacent
    // here the walk was interrupted (stop()) — end silently.
    if (chebyshev(player.position, this.node.position) !== 1) return false

    const reason = validateGather(player, this.node)
    if (reason !== null) {
      events.emit('actionFailed', { reason })
      return false
    }

    const level = player.skills.getCurrentLevel(def.skill)
    const tool = def.requiredToolKind ? findBestTool(player, def.requiredToolKind, level) : null
    if (!rng.chance(gatherSuccessChance(def, level, tool?.tier ?? 0))) return true

    player.inventory.add(def.itemId)
    player.skills.addXp(def.skill, def.xp)
    events.emit('resourceGathered', { nodeId: def.id, itemId: def.itemId, xp: def.xp })

    if (def.depleteChance > 0 && rng.chance(def.depleteChance)) {
      const respawnAtTick = game.tickCount + def.respawnTicks
      this.node.deplete(respawnAtTick)
      const { x, y } = this.node.position
      events.emit('nodeDepleted', { nodeId: def.id, x, y, respawnAtTick })
      return false
    }
    return true
  }
}
