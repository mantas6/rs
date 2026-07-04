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

/**
 * Melee damage types. The attacker's matching attack bonus is rolled
 * against the defender's same-type defence bonus (see combat.ts).
 */
export type AttackType = 'stab' | 'slash' | 'crush'

/** Equipment block for wearable/wieldable items. */
export interface EquipmentDef {
  slot: EquipmentSlot
  /** Base skill levels required to equip. Omitted skills mean no requirement. */
  requirements?: Partial<Record<SkillName, number>>
  /** Stat bonuses; omitted entries default to 0. */
  bonuses: Partial<EquipmentBonuses>
  /** Weapon attack speed in ticks. Unarmed/default is 4. */
  attackSpeed?: number
  /** Melee damage type of a weapon. Unarmed/default is 'crush'. */
  attackType?: AttackType
  /** True for two-handed weapons: equipping one also vacates the shield slot, and a shield cannot be worn while it is equipped. */
  twoHanded?: boolean
}

/** Skills that gather resources from world nodes. */
export type GatherSkill = Extract<SkillName, 'woodcutting' | 'mining' | 'fishing'>

/** Kinds of gathering tools; each ResourceNodeDef requires at most one. */
export type ToolKind = 'axe' | 'pickaxe' | 'net'

/** Gathering-tool block for items usable on resource nodes. */
export interface ToolDef {
  kind: ToolKind
  /** Higher tiers gather slightly faster (see gathering.ts chance formula). */
  tier: number
  /** Level in the matching gather skill required to use the tool. */
  requiredLevel: number
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
  /** Prayer XP granted when buried (present only on buryable bones). */
  buryXp?: number
  /** Present when the item is a gathering tool (axe/pickaxe/net). */
  tool?: ToolDef
}

/**
 * Resource node definition (trees, rocks, fishing spots).
 *
 * Success is rolled once per tick using OSRS-style low/high interpolation:
 * `chanceLow` is the per-tick success chance at level 1 and `chanceHigh` at
 * level 99, linearly interpolated between (see gathering.ts).
 */
export interface ResourceNodeDef {
  id: string
  name: string
  skill: GatherSkill
  /** Minimum (boostable) level in `skill` to gather from this node. */
  levelRequired: number
  /** XP granted in `skill` per successful gather. */
  xp: number
  /** Item received per successful gather. */
  itemId: string
  /** Per-tick success chance at level 1 (before tool bonus). */
  chanceLow: number
  /** Per-tick success chance at level 99 (before tool bonus). */
  chanceHigh: number
  /**
   * Chance (0..1) rolled after each successful gather that the node
   * depletes: 1 = always (regular trees, rocks), 0 = never (fishing spots).
   */
  depleteChance: number
  /** Ticks until a depleted node respawns. */
  respawnTicks: number
  /** Tool kind needed to gather, or null when no tool is required. */
  requiredToolKind: ToolKind | null
  /**
   * Whether the node blocks walking. Trees/rocks block (including while
   * depleted — stumps still block); fishing spots never block.
   */
  blocksMovement: boolean
}

/**
 * Cooking recipe definition.
 *
 * Burn chance interpolates linearly from 0.5 at `levelRequired` down to 0
 * at `burnStopLevel` (see cooking.ts `cookBurnChance`). At and above
 * `burnStopLevel` the food never burns.
 */
export interface CookingRecipeDef {
  /** Raw ingredient consumed per cook attempt. */
  rawItemId: string
  /** Item produced on success. */
  cookedItemId: string
  /** Item produced on a burn (no xp granted). */
  burntItemId: string
  /** Minimum (boostable) cooking level to attempt the recipe. */
  levelRequired: number
  /** Cooking xp per successful (non-burnt) cook. */
  xp: number
  /** Level at (and above) which the recipe never burns. */
  burnStopLevel: number
}

/** Firemaking definition for one kind of logs. */
export interface FiremakingDef {
  /** Logs consumed when the fire lights. */
  logsItemId: string
  /** Minimum (boostable) firemaking level to light these logs. */
  levelRequired: number
  /** Firemaking xp granted when the fire lights. */
  xp: number
  /** Ticks the resulting fire burns before expiring. */
  burnTicks: number
}

/** One ore input consumed by a smelting recipe. */
export interface SmeltingInput {
  itemId: string
  /** Number of this ore consumed per smelt attempt. */
  quantity: number
}

/**
 * Smelting recipe definition (Smithing skill): ore turned into a metal bar
 * at a furnace (see smithing.ts). Every input is consumed per attempt even
 * when the smelt fails, matching OSRS iron smelting where the ore is lost.
 */
export interface SmeltingRecipeDef {
  /** Bar produced on a successful smelt. */
  barItemId: string
  /** Ore(s) consumed per smelt attempt (consumed even on a failed smelt). */
  inputs: SmeltingInput[]
  /** Minimum (boostable) smithing level to smelt. */
  levelRequired: number
  /** Smithing xp per successful (non-failed) smelt. */
  xp: number
  /**
   * Chance (0..1) that a smelt succeeds. Most bars are 1 (always succeed);
   * iron smelts at 0.5, and a failed iron smelt still consumes the ore.
   */
  successChance: number
}

/**
 * Smithing (forging) recipe definition: metal bars hammered into a finished
 * item at an anvil (see smithing.ts). Unlike smelting, forging always
 * succeeds — the bars are consumed and the product is produced every time.
 */
export interface SmithingRecipeDef {
  /** Item produced per successful forge. */
  productItemId: string
  /** Bar consumed to forge the product. */
  barItemId: string
  /** Number of bars consumed per forge. */
  barsRequired: number
  /** Minimum (boostable) smithing level to forge. */
  levelRequired: number
  /** Smithing xp per forge. */
  xp: number
}

/**
 * Tanning recipe definition (Crafting skill): a raw hide turned into leather
 * at a tannery (see crafting.ts). Tanning is a plain conversion — like OSRS
 * it grants no Crafting xp and never fails; the xp comes from sewing the
 * leather into equipment afterwards.
 */
export interface TanningRecipeDef {
  /** Raw hide consumed per tan attempt. */
  hideItemId: string
  /** Leather produced on each tan. */
  leatherItemId: string
}

/**
 * Crafting (sewing) recipe definition: leather stitched into equipment with
 * a needle and thread (see crafting.ts). A needle is required in the
 * inventory (never consumed); `leatherRequired` leather and `threadRequired`
 * thread are consumed per item. Sewing always succeeds.
 */
export interface CraftingRecipeDef {
  /** Item produced per successful sew. */
  productItemId: string
  /** Leather consumed to sew the product. */
  leatherItemId: string
  /** Number of leather consumed per item. */
  leatherRequired: number
  /** Number of thread consumed per item. */
  threadRequired: number
  /** Minimum (boostable) crafting level to sew. */
  levelRequired: number
  /** Crafting xp per item sewn. */
  xp: number
}

/**
 * Static world object definition (bank booths, cooking ranges, shop
 * counters). Placed in the world like resource nodes (see
 * engine/world/worldObject.ts); blocking objects affect walkability exactly
 * like blocking nodes do.
 */
export interface WorldObjectDef {
  id: string
  name: string
  examine: string
  /** Whether the object blocks walking (booths and ranges both do). */
  blocksMovement: boolean
  /** True when the object opens the bank (player.openBank). */
  bank?: boolean
  /** True when food can be cooked on the object (player.cook). */
  cookingSource?: boolean
  /** True when ore can be smelted into bars on the object (player.smelt). */
  smeltingSource?: boolean
  /** True when bars can be forged into items on the object (player.forge). */
  anvilSource?: boolean
  /** True when hides can be tanned into leather on the object (player.tan). */
  tanningSource?: boolean
  /** Id of the shop the object opens (player.openShop), if any. */
  shop?: string
}

/** One line of shop stock: an item sold at a fixed price, never sold out. */
export interface ShopStockEntry {
  itemId: string
  /** Price in coins per item bought. 0 = free. */
  price: number
}

/**
 * Shop definition. Stock is unlimited (entries never sell out) so shops
 * stay stateless and deterministic; buying only moves items and coins.
 */
export interface ShopDef {
  id: string
  name: string
  stock: ShopStockEntry[]
  /**
   * Fraction of an item's base value the shop pays when the player sells to
   * it (e.g. 0.4 = 40%). A general store buys any item; omit to make the
   * shop refuse purchases from the player (selling is disabled there).
   */
  sellRate?: number
}

/** Combat stat block of an NPC (melee only for now). */
export interface NpcCombatDef {
  hitpoints: number
  attackLevel: number
  strengthLevel: number
  defenceLevel: number
  /** Flat attack bonus (equivalent of equipment attack bonus). */
  attackBonus: number
  /** Flat melee strength bonus. */
  strengthBonus: number
  /** Defence bonuses per incoming melee attack type. */
  defenceBonuses: { stab: number; slash: number; crush: number }
  /** Ticks between attacks. */
  attackSpeed: number
  /** Aggressive NPCs attack the player on sight (see npc.ts AGGRO_RANGE). */
  aggressive: boolean
  /** Attack reach in tiles (Chebyshev). Melee-only engine supports 1. */
  attackRange: 1
  /** Damage type of the NPC's attacks. Defaults to 'crush'. */
  attackType?: AttackType
}

/**
 * One weighted entry in a drop table. `itemId: null` is the explicit
 * "nothing" entry: when the weighted roll lands on it, no item drops
 * (its `quantity` is ignored). Weights must be positive integers.
 */
export interface DropEntry {
  itemId: string | null
  /** Fixed quantity, or an inclusive [min, max] range rolled per drop. */
  quantity: number | [number, number]
  weight: number
}

/**
 * Drop table: every `always` entry drops on each death (e.g. bones), then
 * ONE weighted roll is made across `entries` (skipped when empty).
 */
export interface DropTable {
  always?: { itemId: string; quantity: number }[]
  entries: DropEntry[]
}

/** NPC definition. */
export interface NpcDef {
  id: string
  name: string
  examine: string
  combat: NpcCombatDef
  /** Ticks after death until the NPC respawns at its spawn tile. */
  respawnTicks: number
  drops: DropTable
  /** Max Chebyshev distance from spawn while wandering. Default 5. */
  wanderRadius?: number
}
