import type { Game } from '../core/game'
import type { AttackStyle } from '../systems/combat'
import type { EquipmentSave } from '../systems/equipment'
import type { InventorySave } from '../systems/inventory'
import type { SkillsSave } from '../systems/skills'
import type { Vec2 } from '../world/vec2'

/**
 * What an action visually "is", so the UI can pick an animation. Gathering
 * actions report their skill; everything else has a dedicated kind.
 */
export type PlayerActionKind =
  | 'woodcutting'
  | 'mining'
  | 'fishing'
  | 'firemaking'
  | 'cooking'
  | 'smithing'
  | 'crafting'
  | 'fletching'
  | 'farming'
  | 'banking'
  | 'shopping'
  | 'combat'
  | 'pickup'

/**
 * A tick-driven activity the player is performing (chopping, fighting, ...).
 * Set via `player.setAction(...)`; ticked only while the player is not
 * moving. Starting to walk cancels the current action.
 */
export interface PlayerAction {
  /** Called once per tick while active. Return false when finished. */
  onTick(game: Game): boolean
  /** Read-only descriptor for the UI (animation picking). */
  readonly kind?: PlayerActionKind
  /** Tile the action is aimed at (facing target for the UI), if any. */
  readonly targetPosition?: Readonly<Vec2> | null
}

/** Why consuming an inventory item (eating/burying/drinking) failed. */
export type ConsumeFailReason = 'not_food' | 'not_buryable' | 'not_drinkable'

/**
 * JSON-safe snapshot of the player (see Player.serialize). The movement
 * queue and in-progress action are NOT saved: on load the player is idle
 * at the saved tile.
 */
export interface PlayerSave {
  x: number
  y: number
  running: boolean
  attackStyle: AttackStyle
  skills: SkillsSave
  inventory: InventorySave
  equipment: EquipmentSave
}

// Player consumable events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when the player eats food (the item is already consumed). */
    itemEaten: { itemId: string; healed: number; hpAfter: number }
    /**
     * Emitted when the player drinks a drinkable (the item is already
     * consumed, boosts applied and any empty container added). `emptyItemId`
     * is the container left behind, or null when the drink leaves nothing.
     */
    itemDrunk: { itemId: string; emptyItemId: string | null }
    /** Emitted when the player drops an inventory stack on the ground. */
    itemDropped: { itemId: string; quantity: number; x: number; y: number }
    /** Emitted when the player buries bones (the bone is already consumed). */
    bonesBuried: { itemId: string; xp: number }
  }
}
