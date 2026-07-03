// Content type definitions. Content files are data-only: plain objects,
// no logic, no classes, no side effects.

// Type-only import from the engine (erased at runtime, so content stays
// free of engine code). skills.ts is the single source of truth for names.
import type { SkillName } from '../engine/systems/skills'

/**
 * Map definition.
 *
 * `tiles` is a row-major grid encoded as one string per row:
 *   '.' = walkable
 *   '#' = blocked
 * `tiles.length` must equal `height` and every row's length must equal
 * `width`. Tile (x, y) is `tiles[y][x]`.
 */
export interface MapDef {
  id: string
  name: string
  /** Map width in tiles. Must match the length of every row in `tiles`. */
  width: number
  /** Map height in tiles. Must match `tiles.length`. */
  height: number
  /** Row-major tile rows; see interface docs for the encoding. */
  tiles: string[]
  /**
   * Optional player spawn tile. Must be walkable. When omitted, the engine
   * falls back to the first walkable tile in row-major order.
   */
  spawn?: { x: number; y: number }
}

/** Slots a piece of equipment can occupy (OSRS worn-equipment layout). */
export type EquipmentSlot =
  | 'head'
  | 'cape'
  | 'neck'
  | 'ammo'
  | 'weapon'
  | 'body'
  | 'shield'
  | 'legs'
  | 'hands'
  | 'feet'
  | 'ring'

/**
 * Full set of equipment stat bonuses. Content declares these as a Partial
 * (omitted entries mean 0); the engine normalizes to this full shape via
 * `normalizeBonuses` (src/engine/systems/itemRegistry.ts).
 */
export interface EquipmentBonuses {
  attackStab: number
  attackSlash: number
  attackCrush: number
  attackMagic: number
  attackRanged: number
  defenceStab: number
  defenceSlash: number
  defenceCrush: number
  defenceMagic: number
  defenceRanged: number
  meleeStrength: number
  rangedStrength: number
  magicDamage: number
  prayer: number
}

/** Equipment block for wearable/wieldable items. */
export interface EquipmentDef {
  slot: EquipmentSlot
  /** Base skill levels required to equip. Omitted skills mean no requirement. */
  requirements?: Partial<Record<SkillName, number>>
  /** Stat bonuses; omitted entries default to 0. */
  bonuses: Partial<EquipmentBonuses>
  /** Weapon attack speed in ticks. Unarmed/default is 4. */
  attackSpeed?: number
}

/** Item definition. */
export interface ItemDef {
  id: string
  name: string
  examine: string
  /** Stackable items merge into a single inventory slot. */
  stackable: boolean
  /** Base value in coins. */
  value: number
  /** Present when the item can be equipped. */
  equipment?: EquipmentDef
  /** Hitpoints restored when eaten (food items only). */
  healAmount?: number
}
