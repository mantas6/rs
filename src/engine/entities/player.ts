import type { EquipmentSlot } from '../../content/types'
import type { EventBus } from '../core/eventBus'
import type { Game } from '../core/game'
import { OpenBankAction } from '../systems/bank'
import { AttackAction, type AttackStyle, RANGED_RAPID_SPEED_REDUCTION } from '../systems/combat'
import { CookAction, type CookingSource, getCookingRecipe, validateCook } from '../systems/cooking'
import {
  CraftAction,
  getCraftingRecipe,
  getTanningRecipe,
  TanAction,
  type TanningSource,
  validateCraft,
  validateTan,
} from '../systems/crafting'
import { Equipment } from '../systems/equipment'
import { HarvestAction, PlantAction, validateHarvest, validatePlant } from '../systems/farming'
import {
  type FireManager,
  getFiremakingDef,
  LightFireAction,
  validateLightFire,
} from '../systems/firemaking'
import {
  FletchAction,
  FletchAssembleAction,
  getFletchingAssemblyRecipe,
  getFletchingRecipe,
  validateFletch,
  validateFletchAssemble,
} from '../systems/fletching'
import { GatherAction, validateGather } from '../systems/gathering'
import {
  CleanAction,
  getHerbCleaningRecipe,
  getPotionRecipe,
  getUnfinishedPotionRecipe,
  MixPotionAction,
  MixUnfinishedAction,
  validateClean,
  validateMixPotion,
  validateMixUnfinished,
} from '../systems/herblore'
import { Inventory } from '../systems/inventory'
import { getItemDef } from '../systems/itemRegistry'
import { Prayers } from '../systems/prayer'
import { OpenShopAction } from '../systems/shop'
import { Skills } from '../systems/skills'
import {
  type AnvilSource,
  ForgeAction,
  getSmeltingRecipe,
  getSmithingRecipe,
  SmeltAction,
  type SmeltingSource,
  validateForge,
  validateSmelt,
} from '../systems/smithing'
import {
  GROUND_ITEM_DESPAWN_TICKS,
  type GroundItem,
  type GroundItemManager,
  PickUpAction,
} from '../world/groundItems'
import type { FarmPatch } from '../world/farmPatch'
import { findPath, findPathAdjacent, findPathWithinRange } from '../world/pathfinding'
import type { ResourceNode } from '../world/resourceNode'
import type { World } from '../world/tileMap'
import { chebyshev, type Vec2 } from '../world/vec2'
import type { WorldObject } from '../world/worldObject'
import type { Npc } from './npc'
// Player-related type declarations and consumable event augmentations live in
// playerTypes.ts (a cohesive, logic-free module). They are re-exported here so
// existing `import ... from '../entities/player'` sites and the engine barrel
// keep working unchanged.
import type { PlayerAction, PlayerSave } from './playerTypes'

export type { ConsumeFailReason, PlayerAction, PlayerActionKind, PlayerSave } from './playerTypes'

/**
 * Run energy is stored internally as an integer in hundredths of a percent
 * (0..10000), OSRS-style. Using sub-percent units keeps regeneration integer
 * and deterministic while still letting the rate scale finely with Agility.
 * The public `runEnergy` getter exposes it as a whole-percent 0..100 for the
 * UI; saves persist the raw 0..10000 value for full fidelity.
 */
export const RUN_ENERGY_MAX = 10000

/** Run energy drained per tile actually stepped while running (1% per tile). */
export const RUN_DRAIN_PER_TILE = 100

/** Base run energy regenerated per tick while not running (0.24%/tick). */
export const RUN_REGEN_BASE = 24

/** Extra run-energy regen per Agility level per tick (0.02%/level/tick). */
export const RUN_REGEN_PER_AGILITY = 2

/**
 * Run energy regenerated per tick while walking or idle, in internal units.
 * Scales with the Agility base level, mirroring OSRS (higher Agility = faster
 * recovery). Fully integer and deterministic.
 *
 * NOTE: Agility XP is intentionally NOT awarded from running — that would be
 * non-canonical (OSRS grants Agility XP from courses, not from moving). Agility
 * only affects the regen rate here.
 * TODO: award Agility XP via dedicated Agility courses (a future feature).
 */
export function runEnergyRegenRate(agilityLevel: number): number {
  return RUN_REGEN_BASE + agilityLevel * RUN_REGEN_PER_AGILITY
}

export class Player {
  readonly skills: Skills
  readonly inventory: Inventory
  readonly equipment: Equipment
  readonly prayers: Prayers

  private _x: number
  private _y: number
  private _running = false
  /** Run energy in internal units (0..RUN_ENERGY_MAX); see RUN_ENERGY_MAX. */
  private _runEnergy = RUN_ENERGY_MAX
  private _action: PlayerAction | null = null
  private _attackStyle: AttackStyle = 'accurate'
  /**
   * Tick at which the player may next attack (0 = immediately). Kept on the
   * player — not on the transient AttackAction — so re-issuing attack()
   * (spam-clicking or switching targets) cannot reset the cooldown and swing
   * faster than the weapon speed. See canAttack/markAttacked.
   */
  private _nextAttackTick = 0
  /** Remaining tiles to step through, in order. */
  private path: Vec2[] = []

  constructor(
    private readonly world: World,
    private readonly events: EventBus,
    start: Vec2,
    private readonly fires: FireManager,
    private readonly groundItems: GroundItemManager,
    /** Current tick supplier (the Game's tick counter). Used by drop(). */
    private readonly getTick: () => number,
  ) {
    if (!world.isWalkable(start.x, start.y)) {
      throw new Error(`Player start tile (${start.x}, ${start.y}) is not walkable`)
    }
    this._x = start.x
    this._y = start.y
    this.skills = new Skills(events)
    this.inventory = new Inventory(events)
    this.equipment = new Equipment(events)
    this.prayers = new Prayers(events)
  }

  /**
   * Activate a combat prayer (drains prayer points while on; boosts combat).
   * Returns false when the prayer is unknown/already on, the base Prayer
   * level is too low, or prayer points are depleted. See systems/prayer.ts.
   */
  activatePrayer(id: string): boolean {
    return this.prayers.activate(id, this.skills)
  }

  /** Deactivate a combat prayer. Returns false when it was not active. */
  deactivatePrayer(id: string): boolean {
    return this.prayers.deactivate(id)
  }

  /** Toggle a combat prayer on/off. Returns the resulting active state. */
  togglePrayer(id: string): boolean {
    return this.prayers.toggle(id, this.skills)
  }

  /**
   * Equip an inventory item by slot index or item id. Returns false when
   * the item is missing, not equipment, or requirements are unmet.
   */
  equip(slotOrItemId: number | string): boolean {
    return this.equipment.equip(this.inventory, this.skills, slotOrItemId)
  }

  /** Unequip a worn slot back into the inventory (false when full/empty). */
  unequip(slot: EquipmentSlot): boolean {
    return this.equipment.unequip(slot, this.inventory)
  }

  /**
   * Eat one food item from an inventory slot (instant; no walking and the
   * current action is kept). Heals `healAmount` hitpoints, capped at the
   * base level; food is consumed even at full hp (OSRS behavior). Emits
   * `itemEaten` on success, `actionFailed: not_food` for non-food items,
   * and returns false for an empty slot without emitting.
   */
  eat(slotIndex: number): boolean {
    const stack = this.inventory.get(slotIndex)
    if (stack === null) return false
    const def = getItemDef(stack.itemId)
    if (def.healAmount === undefined) {
      this.events.emit('actionFailed', { reason: 'not_food' })
      return false
    }
    this.inventory.removeSlot(slotIndex, 1)
    const base = this.skills.getLevel('hitpoints')
    const current = this.skills.getCurrentLevel('hitpoints')
    const healed = Math.min(def.healAmount, Math.max(0, base - current))
    if (healed > 0) this.skills.boost('hitpoints', healed)
    this.events.emit('itemEaten', { itemId: def.id, healed, hpAfter: current + healed })
    return true
  }

  /**
   * Drink one drinkable item from an inventory slot (instant; no walking and
   * the current action is kept). Consumes one item, heals `drink.healAmount`
   * hitpoints (capped at the base level, like eat), applies each temporary
   * boost/drain via Skills.boost, then adds `drink.emptyItemId` (the empty
   * beer glass) to the inventory. Because the drink is removed first, its slot
   * is normally free for the empty container; if the inventory still has no
   * room, the empty container is simply discarded. Emits `itemDrunk` on
   * success, `actionFailed: not_drinkable` for non-drinkable items, and
   * returns false for an empty slot without emitting.
   */
  drink(slotIndex: number): boolean {
    const stack = this.inventory.get(slotIndex)
    if (stack === null) return false
    const def = getItemDef(stack.itemId)
    if (def.drink === undefined) {
      this.events.emit('actionFailed', { reason: 'not_drinkable' })
      return false
    }
    this.inventory.removeSlot(slotIndex, 1)
    if (def.drink.healAmount !== undefined && def.drink.healAmount > 0) {
      const base = this.skills.getLevel('hitpoints')
      const current = this.skills.getCurrentLevel('hitpoints')
      const healed = Math.min(def.drink.healAmount, Math.max(0, base - current))
      if (healed > 0) this.skills.boost('hitpoints', healed)
    }
    for (const { skill, delta } of def.drink.boosts ?? []) {
      this.skills.boost(skill, delta)
    }
    let emptyItemId: string | null = null
    if (def.drink.emptyItemId !== undefined) {
      // The drink's slot was just freed, so the empty container normally fits;
      // if the inventory is somehow still full, it is simply discarded.
      if (this.inventory.add(def.drink.emptyItemId) > 0) emptyItemId = def.drink.emptyItemId
    }
    this.events.emit('itemDrunk', { itemId: def.id, emptyItemId })
    return true
  }

  /**
   * Bury one bone from an inventory slot (instant; no walking and the
   * current action is kept). Consumes exactly one item and grants the
   * item's `buryXp` in Prayer. Emits `bonesBuried` on success,
   * `actionFailed: not_buryable` for items without `buryXp`, and returns
   * false for an empty slot without emitting.
   */
  bury(slotIndex: number): boolean {
    const stack = this.inventory.get(slotIndex)
    if (stack === null) return false
    const def = getItemDef(stack.itemId)
    if (def.buryXp === undefined) {
      this.events.emit('actionFailed', { reason: 'not_buryable' })
      return false
    }
    this.inventory.removeSlot(slotIndex, 1)
    this.skills.addXp('prayer', def.buryXp)
    this.events.emit('bonesBuried', { itemId: def.id, xp: def.buryXp })
    return true
  }

  /**
   * Drop the whole stack in an inventory slot onto the player's tile
   * (instant, like eat). The stack becomes a ground item with the standard
   * despawn timer. Emits `itemDropped` (plus `groundItemAdded` from the
   * ground-item manager); returns false for an empty slot.
   */
  drop(slotIndex: number): boolean {
    const removed = this.inventory.removeSlot(slotIndex)
    if (removed === null) return false
    this.groundItems.add(
      removed.itemId,
      removed.quantity,
      this._x,
      this._y,
      this.getTick() + GROUND_ITEM_DESPAWN_TICKS,
    )
    this.events.emit('itemDropped', {
      itemId: removed.itemId,
      quantity: removed.quantity,
      x: this._x,
      y: this._y,
    })
    return true
  }

  get x(): number {
    return this._x
  }

  get y(): number {
    return this._y
  }

  get position(): Vec2 {
    return { x: this._x, y: this._y }
  }

  get running(): boolean {
    return this._running
  }

  /**
   * Current run energy as a whole-percent value in [0, 100], for the UI.
   * Stored internally at finer (hundredths-of-a-percent) resolution; see
   * RUN_ENERGY_MAX.
   */
  get runEnergy(): number {
    return Math.floor(this._runEnergy / 100)
  }

  get isMoving(): boolean {
    return this.path.length > 0
  }

  get action(): PlayerAction | null {
    return this._action
  }

  get attackStyle(): AttackStyle {
    return this._attackStyle
  }

  /** Set the melee attack style (routes combat xp; see combat.ts). */
  setAttackStyle(style: AttackStyle): void {
    this._attackStyle = style
  }

  setRun(running: boolean): void {
    this._running = running
  }

  /** Set the current action, replacing any previous one. */
  setAction(action: PlayerAction | null): void {
    this._action = action
  }

  /**
   * Queue movement to (x, y). Replaces any existing movement queue and
   * cancels the current action (OSRS behavior). Returns false when the
   * target is blocked or unreachable (player state is unchanged).
   */
  walkTo(x: number, y: number): boolean {
    const path = findPath(this.world, this.position, { x, y })
    if (path === null) return false
    this._action = null
    this.path = path
    return true
  }

  /** Clear the movement queue. Does not cancel the current action. */
  stop(): void {
    this.path = []
  }

  /**
   * Queue movement to a tile adjacent to `target` WITHOUT cancelling the
   * current action. Used by combat to chase a moving NPC mid-action.
   * Returns false when no adjacent tile is reachable.
   */
  chase(target: Vec2): boolean {
    const path = findPathAdjacent(this.world, this.position, target)
    if (path === null) return false
    this.path = path
    return true
  }

  /**
   * Like `chase`, but closes only to within `range` tiles (Chebyshev) of
   * `target` rather than to melee adjacency. Used by ranged combat to keep
   * firing from a distance. Returns false when no in-range tile is reachable.
   */
  chaseWithinRange(target: Vec2, range: number): boolean {
    const path = findPathWithinRange(this.world, this.position, target, range)
    if (path === null) return false
    this.path = path
    return true
  }

  /**
   * Instantly move to (x, y), clearing the movement queue and current
   * action. Used for death respawns. The target tile must be walkable.
   */
  teleport(x: number, y: number): void {
    if (!this.world.isWalkable(x, y)) {
      throw new Error(`Player.teleport: (${x}, ${y}) is not walkable`)
    }
    this._x = x
    this._y = y
    this.path = []
    this._action = null
    this.events.emit('playerMoved', { x, y })
  }

  /**
   * Walk-then-act helper: queue movement to a tile adjacent (Chebyshev 1) to
   * `target`, then set `action` so it begins ticking on arrival. Replaces the
   * movement queue and current action. Returns false (leaving state unchanged)
   * when no adjacent tile is reachable. Shared by every "walk up to something
   * and act on it" command (gather/plant/harvest/attack/cook/smelt/forge/tan/
   * openBank/openShop).
   */
  private walkAdjacentThen(target: Vec2, action: PlayerAction): boolean {
    const path = findPathAdjacent(this.world, this.position, target)
    if (path === null) return false
    this.path = path
    this._action = action
    return true
  }

  /**
   * Walk-then-act helper for actions performed ON a tile rather than adjacent
   * to it: queue movement onto `tile`, then set `action`. Returns false
   * (leaving state unchanged) when the tile is unreachable. Used by pickUp.
   */
  private walkOntoThen(tile: Vec2, action: PlayerAction): boolean {
    const path = findPath(this.world, this.position, tile)
    if (path === null) return false
    this.path = path
    this._action = action
    return true
  }

  /**
   * Start gathering from a resource node. Validates up front (emitting
   * `actionFailed` with the reason on failure), then queues a walk to a
   * tile adjacent (Chebyshev 1) to the node and sets a GatherAction. The
   * action only ticks once movement completes, so walking then gathering
   * needs no extra state. Returns false when validation fails or no
   * adjacent tile is reachable (unreachable emits no event).
   */
  gather(node: ResourceNode): boolean {
    const reason = validateGather(this, node)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    return this.walkAdjacentThen(node.position, new GatherAction(node))
  }

  /**
   * Start planting a seed in a farm patch. Validates up front (emitting
   * `actionFailed` with the reason on failure), then queues a walk to a tile
   * adjacent (Chebyshev 1) to the patch and sets a PlantAction (walk-then-act,
   * like gathering). Returns false when validation fails or no adjacent tile
   * is reachable (unreachable emits no event).
   */
  plant(seedItemId: string, patch: FarmPatch): boolean {
    const reason = validatePlant(this, patch, seedItemId)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    return this.walkAdjacentThen(patch.position, new PlantAction(patch, seedItemId))
  }

  /**
   * Start harvesting a grown crop from a farm patch. Validates up front
   * (emitting `actionFailed` with the reason on failure), then queues a walk
   * to a tile adjacent to the patch and sets a HarvestAction (walk-then-act,
   * like planting). Returns false when validation fails or no adjacent tile is
   * reachable (unreachable emits no event).
   */
  harvest(patch: FarmPatch): boolean {
    const reason = validateHarvest(this, patch)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    return this.walkAdjacentThen(patch.position, new HarvestAction(patch))
  }

  /**
   * Start attacking an NPC: queues a walk to an adjacent tile and sets an
   * AttackAction (walk-then-act, like gathering). Emits `actionFailed`
   * with 'target_dead' for a dead target; returns false when the target
   * is dead or unreachable (unreachable emits no event).
   */
  attack(npc: Npc): boolean {
    if (!npc.alive) {
      this.events.emit('actionFailed', { reason: 'target_dead' })
      return false
    }
    const range = this.equipment.weaponRange()
    // Melee weapons (range 1) walk to adjacency, exactly as before.
    if (range <= 1) return this.walkAdjacentThen(npc.position, new AttackAction(npc))
    // Ranged weapons only need to be within weapon range: act in place when
    // already in range, otherwise path to the nearest in-range tile.
    if (chebyshev(this.position, npc.position) <= range) {
      this.path = []
      this._action = new AttackAction(npc)
      return true
    }
    const path = findPathWithinRange(this.world, this.position, npc.position, range)
    if (path === null) return false
    this.path = path
    this._action = new AttackAction(npc)
    return true
  }

  /**
   * True when the player's melee attack cooldown has elapsed and they may
   * swing this tick. Engine-internal (used by AttackAction). Because the
   * cooldown lives on the player, re-creating the AttackAction — by
   * spam-clicking or switching targets — cannot bypass it.
   */
  canAttack(tick: number): boolean {
    return tick >= this._nextAttackTick
  }

  /**
   * Record a melee swing on `tick`, starting the weapon-speed cooldown
   * before the next attack is allowed. Engine-internal (AttackAction calls
   * this after performing an attack).
   */
  markAttacked(tick: number): void {
    this._nextAttackTick = tick + this.effectiveAttackSpeed()
  }

  /**
   * Attack speed in ticks for the next swing: the weapon's base speed, minus
   * one (to a floor of 1) when firing a bow on the Rapid ranged style. Melee
   * weapons are unaffected, so melee timing is identical to before.
   */
  private effectiveAttackSpeed(): number {
    const base = this.equipment.weaponSpeed()
    if (this.equipment.isRangedWeapon() && this._attackStyle === 'ranged_rapid') {
      return Math.max(1, base - RANGED_RAPID_SPEED_REDUCTION)
    }
    return base
  }

  /**
   * Start picking up a ground item: queues a walk to the item's tile and
   * sets a PickUpAction (walk-then-act). Returns false when the tile is
   * unreachable. Inventory space is checked on arrival (the pickup tick),
   * emitting `actionFailed: inventory_full` when nothing fits.
   */
  pickUp(item: GroundItem): boolean {
    return this.walkOntoThen({ x: item.x, y: item.y }, new PickUpAction(item))
  }

  /**
   * Start lighting a fire on the current tile with logs from the inventory
   * (no walking — you light where you stand). Validates up front (tinderbox,
   * logs, level, and that the tile is free of fires), emitting `actionFailed`
   * with the reason on failure, then sets a LightFireAction that rolls a
   * per-tick light chance (see firemaking.ts). Throws on unknown logs ids.
   */
  lightFire(logsItemId = 'logs'): boolean {
    const def = getFiremakingDef(logsItemId)
    const reason = validateLightFire(this, def, this.world, this.fires, this.position)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    this._action = new LightFireAction(def)
    return true
  }

  /**
   * Start cooking raw food on a fire or cooking-range object. Validates up
   * front (source valid, level, has the raw item), emitting `actionFailed`
   * with the reason on failure, then queues a walk to a tile adjacent to
   * the source and sets a CookAction (walk-then-act, like gathering; one
   * item per 4 ticks). Returns false when validation fails or no adjacent
   * tile is reachable (unreachable emits no event). Throws when no recipe
   * exists for `rawItemId`.
   */
  cook(rawItemId: string, source: CookingSource): boolean {
    const recipe = getCookingRecipe(rawItemId)
    const reason = validateCook(this, recipe, source)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    return this.walkAdjacentThen(source.position, new CookAction(recipe, source))
  }

  /**
   * Start smelting ore into a metal bar at a furnace. Validates up front
   * (source valid, level, has every ore input), emitting `actionFailed`
   * with the reason on failure, then queues a walk to a tile adjacent to
   * the furnace and sets a SmeltAction (walk-then-act, like cooking; one
   * bar per SMELT_INTERVAL_TICKS). Returns false when validation fails or
   * no adjacent tile is reachable (unreachable emits no event). Throws when
   * no recipe exists for `barItemId`.
   */
  smelt(barItemId: string, source: SmeltingSource): boolean {
    const recipe = getSmeltingRecipe(barItemId)
    const reason = validateSmelt(this, recipe, source)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    return this.walkAdjacentThen(source.position, new SmeltAction(recipe, source))
  }

  /**
   * Start forging metal bars into a finished item at an anvil. Validates up
   * front (source valid, level, has enough bars), emitting `actionFailed`
   * with the reason on failure, then queues a walk to a tile adjacent to the
   * anvil and sets a ForgeAction (walk-then-act, like smelting; one product
   * per FORGE_INTERVAL_TICKS). Returns false when validation fails or no
   * adjacent tile is reachable (unreachable emits no event). Throws when no
   * recipe exists for `productItemId`.
   */
  forge(productItemId: string, source: AnvilSource): boolean {
    const recipe = getSmithingRecipe(productItemId)
    const reason = validateForge(this, recipe, source)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    return this.walkAdjacentThen(source.position, new ForgeAction(recipe, source))
  }

  /**
   * Start tanning hides into leather at a tannery. Validates up front
   * (source valid, has the hide), emitting `actionFailed` with the reason on
   * failure, then queues a walk to a tile adjacent to the tannery and sets a
   * TanAction (walk-then-act, like smelting; one leather per
   * TAN_INTERVAL_TICKS). Returns false when validation fails or no adjacent
   * tile is reachable (unreachable emits no event). Throws when no recipe
   * exists for `hideItemId`.
   */
  tan(hideItemId: string, source: TanningSource): boolean {
    const recipe = getTanningRecipe(hideItemId)
    const reason = validateTan(this, recipe, source)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    return this.walkAdjacentThen(source.position, new TanAction(recipe, source))
  }

  /**
   * Start sewing leather into equipment from the inventory (no walking — you
   * sew where you stand, like lighting a fire). Validates up front (needle,
   * level, enough leather and thread), emitting `actionFailed` with the
   * reason on failure, then sets a CraftAction that produces one item per
   * CRAFT_INTERVAL_TICKS until the materials run out. Throws when no recipe
   * exists for `productItemId`.
   */
  craft(productItemId: string): boolean {
    const recipe = getCraftingRecipe(productItemId)
    const reason = validateCraft(this, recipe)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    this._action = new CraftAction(recipe)
    return true
  }

  /**
   * Start carving logs into fletching products from the inventory (no
   * walking — you carve where you stand, like sewing leather). Validates up
   * front (knife, level, at least one log), emitting `actionFailed` with the
   * reason on failure, then sets a FletchAction that produces one batch per
   * FLETCH_INTERVAL_TICKS until the logs run out. Throws when no recipe
   * exists for `productItemId`.
   */
  fletch(productItemId: string): boolean {
    const recipe = getFletchingRecipe(productItemId)
    const reason = validateFletch(this, recipe)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    this._action = new FletchAction(recipe)
    return true
  }

  /**
   * Start assembling a fletching product from two inventory items (no tool,
   * no walking): stringing an unstrung bow with a bow string, or building
   * arrows (shafts + feather, headless arrows + arrowtips). Validates up
   * front (level and both inputs), emitting `actionFailed` with the reason on
   * failure, then sets a FletchAssembleAction that produces one per
   * FLETCH_INTERVAL_TICKS until an input runs out. Throws when no assembly
   * recipe exists for `productItemId`.
   */
  fletchAssemble(productItemId: string): boolean {
    const recipe = getFletchingAssemblyRecipe(productItemId)
    const reason = validateFletchAssemble(this, recipe)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    this._action = new FletchAssembleAction(recipe)
    return true
  }

  /**
   * Start cleaning grimy herbs into clean herbs from the inventory (no
   * walking — you clean where you stand, like sewing leather). Validates up
   * front (level, at least one grimy herb), emitting `actionFailed` with the
   * reason on failure, then sets a CleanAction that cleans one herb per
   * HERBLORE_INTERVAL_TICKS until the grimy herbs run out. Throws when no
   * cleaning recipe exists for `grimyItemId`.
   */
  clean(grimyItemId: string): boolean {
    const recipe = getHerbCleaningRecipe(grimyItemId)
    const reason = validateClean(this, recipe)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    this._action = new CleanAction(recipe)
    return true
  }

  /**
   * Start mixing clean herbs and vials of water into unfinished potions from
   * the inventory (no walking, like cleaning). Validates up front (a clean
   * herb and a vial of water), emitting `actionFailed` with the reason on
   * failure, then sets a MixUnfinishedAction that mixes one per
   * HERBLORE_INTERVAL_TICKS until an ingredient runs out. Grants no xp (like
   * OSRS). Throws when no recipe exists for `unfinishedItemId`.
   */
  mixUnfinished(unfinishedItemId: string): boolean {
    const recipe = getUnfinishedPotionRecipe(unfinishedItemId)
    const reason = validateMixUnfinished(this, recipe)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    this._action = new MixUnfinishedAction(recipe)
    return true
  }

  /**
   * Start mixing unfinished potions and secondaries into finished potions
   * from the inventory (no walking, like cleaning). Validates up front (level,
   * an unfinished potion and a secondary), emitting `actionFailed` with the
   * reason on failure, then sets a MixPotionAction that mixes one per
   * HERBLORE_INTERVAL_TICKS until an ingredient runs out. Throws when no
   * recipe exists for `potionItemId`.
   */
  mixPotion(potionItemId: string): boolean {
    const recipe = getPotionRecipe(potionItemId)
    const reason = validateMixPotion(this, recipe)
    if (reason !== null) {
      this.events.emit('actionFailed', { reason })
      return false
    }
    this._action = new MixPotionAction(recipe)
    return true
  }

  /**
   * Start opening the bank at a bank booth: queues a walk to an adjacent
   * tile and sets an OpenBankAction (walk-then-act). Emits `actionFailed:
   * invalid_source` for a non-bank object; returns false when the booth is
   * unreachable (unreachable emits no event). The bank closes again on any
   * movement (see bank.ts) or via `game.bank.close()`.
   */
  openBank(booth: WorldObject): boolean {
    if (!booth.def.bank) {
      this.events.emit('actionFailed', { reason: 'invalid_source' })
      return false
    }
    return this.walkAdjacentThen(booth.position, new OpenBankAction(booth))
  }

  /**
   * Start opening the shop at a shop counter: queues a walk to an adjacent
   * tile and sets an OpenShopAction (walk-then-act, like banking). Emits
   * `actionFailed: invalid_source` for objects without a shop; returns
   * false when the counter is unreachable (unreachable emits no event).
   * The shop closes again on any movement (see shop.ts) or via
   * `game.shop.close()`.
   */
  openShop(counter: WorldObject): boolean {
    if (!counter.def.shop) {
      this.events.emit('actionFailed', { reason: 'invalid_source' })
      return false
    }
    return this.walkAdjacentThen(counter.position, new OpenShopAction(counter))
  }

  /** JSON-safe snapshot of the player, for save/load. */
  serialize(): PlayerSave {
    return {
      x: this._x,
      y: this._y,
      running: this._running,
      // Raw internal units (0..RUN_ENERGY_MAX), not the whole-percent getter.
      runEnergy: this._runEnergy,
      attackStyle: this._attackStyle,
      skills: this.skills.serialize(),
      inventory: this.inventory.serialize(),
      equipment: this.equipment.serialize(),
    }
  }

  /**
   * Restore a snapshot from `serialize()`. The movement queue and current
   * action are dropped (the player loads idle). Throws when the saved tile
   * is not walkable. Emits no events: restore runs during game
   * construction, before any listeners subscribe.
   */
  restore(save: PlayerSave): void {
    if (!this.world.isWalkable(save.x, save.y)) {
      throw new Error(`Player.restore: (${save.x}, ${save.y}) is not walkable`)
    }
    this._x = save.x
    this._y = save.y
    this.path = []
    this._action = null
    this._running = save.running
    // Lenient: saves predating run energy (or with an out-of-range value)
    // default to a full tank. Clamp to the valid integer range.
    this._runEnergy = Number.isFinite(save.runEnergy)
      ? Math.max(0, Math.min(RUN_ENERGY_MAX, Math.floor(save.runEnergy)))
      : RUN_ENERGY_MAX
    this._attackStyle = save.attackStyle
    this.skills.restore(save.skills)
    this.inventory.restore(save.inventory)
    this.equipment.restore(save.equipment)
    // Prayers are transient (never saved): always load with none active.
    this.prayers.reset()
  }

  /**
   * Advance one tick: walk 1 tile (2 when actually running) along the queued
   * path, or tick the current action when idle. Also updates run energy:
   * moving while running drains it; walking or standing still regenerates it
   * (faster at higher Agility). Running is only effective while energy
   * remains; hitting 0 auto-reverts the player to walking (see
   * drainRunEnergy). Called by Game.tick — not UI code.
   */
  update(game: Game): void {
    if (this.path.length > 0) {
      // Running only takes effect while there is energy to spend.
      const runningNow = this._running && this._runEnergy > 0
      const steps = runningNow ? 2 : 1
      let stepped = 0
      for (let i = 0; i < steps && this.path.length > 0; i++) {
        const next = this.path.shift() as Vec2
        this._x = next.x
        this._y = next.y
        stepped++
      }
      this.events.emit('playerMoved', { x: this._x, y: this._y })
      if (runningNow) this.drainRunEnergy(stepped)
      else this.regenRunEnergy()
      return
    }
    // Standing still (idle or performing a stationary action) regenerates.
    this.regenRunEnergy()
    if (this._action) {
      const stillActive = this._action.onTick(game)
      if (!stillActive) this._action = null
    }
  }

  /**
   * Spend run energy for `tiles` tiles stepped while running. When energy is
   * exhausted the player auto-reverts to walking (running flag cleared), like
   * OSRS; re-enabling run via setRun once energy has recovered resumes it.
   */
  private drainRunEnergy(tiles: number): void {
    this._runEnergy = Math.max(0, this._runEnergy - tiles * RUN_DRAIN_PER_TILE)
    if (this._runEnergy === 0) this._running = false
  }

  /** Recover run energy for one tick, scaled by Agility (capped at max). */
  private regenRunEnergy(): void {
    if (this._runEnergy >= RUN_ENERGY_MAX) return
    const rate = runEnergyRegenRate(this.skills.getLevel('agility'))
    this._runEnergy = Math.min(RUN_ENERGY_MAX, this._runEnergy + rate)
  }
}
