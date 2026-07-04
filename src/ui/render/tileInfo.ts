// Pure descriptions of what sits on a tile: the OSRS-style combat level of an
// NPC def and the one-line hover tooltip. No THREE, no rendering — just reads
// engine state, so both are trivially unit-testable.
import type { NpcDef } from '../../content/types'
import type { Game } from '../../engine'
import { getItemDef } from '../../engine'

/**
 * Approximate OSRS combat level for an NPC def (melee-only stats; ranged,
 * magic and prayer terms are omitted because NPCs have none here).
 */
export function npcCombatLevel(def: NpcDef): number {
  const c = def.combat
  const base = 0.25 * (c.defenceLevel + c.hitpoints)
  const melee = 0.325 * (c.attackLevel + c.strengthLevel)
  return Math.max(1, Math.floor(base + melee))
}

/** One-line description of what sits on a tile (hover tooltip), or null. */
export function describeTile(game: Game, x: number, y: number): string | null {
  const npc = game.npcs.find((n) => n.alive && n.x === x && n.y === y)
  if (npc) return `${npc.def.name} (level ${npcCombatLevel(npc.def)})`
  const node = game.world.nodeAt(x, y)
  if (node) return node.depleted ? `${node.def.name} (depleted)` : node.def.name
  const patch = game.world.patchAt(x, y)
  if (patch) {
    if (!patch.isPlanted) return `${patch.def.name} (empty)`
    return patch.isGrown() ? `${patch.def.name} (ready)` : `${patch.def.name} (growing)`
  }
  const object = game.world.objectAt(x, y)
  if (object) return object.def.name
  const item = game.groundItems.itemsAt(x, y)[0]
  if (item) return `Take ${getItemDef(item.itemId).name}`
  if (game.fires.fireAt(x, y)) return 'Fire'
  return null
}
