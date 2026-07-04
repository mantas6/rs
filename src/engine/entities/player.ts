import type { EquipmentSlot } from '../../content/types'
import type { EventBus } from '../core/eventBus'
import type { Game } from '../core/game'
import { OpenBankAction } from '../systems/bank'
import { AttackAction, type AttackStyle } from '../systems/combat'
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
import { Equipment, type EquipmentSave } from '../systems/equipment'
import { HarvestAction, PlantAction, validateHarvest, validatePlant } from '../systems/farming'
import {
  type FireManager,
  getFiremakingDef,
  LightFireAction,
  validateLightFire,
} from '../systems/firemaking'
import { FletchAction, getFletchingRecipe, validateFletch } from '../systems/fletching'
import { GatherAction, validateGather } from '../systems/gathering'
import { Inventory, type InventorySave } from '../systems/inventory'
import { getItemDef } from '../systems/itemRegistry'
import { Prayers } from '../systems/prayer'
import { OpenShopAction } from '../systems/shop'
import { Skills, type SkillsSave } from '../systems/skills'
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
import { findPath, findPathAdjacent } from '../world/pathfinding'
import type { ResourceNode } from '../world/resourceNode'
import type { World } from '../world/tileMap'
import type { Vec2 } from '../world/vec2'
import type { WorldObject } from '../world/worldObject'
import type { Npc } from './npc'

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

export class Player {
  readonly skills: Skills
  readonly inventory: Inventory
  readonly equipment: Equipment
  readonly prayers: Prayers

  private _x: number
  private _y: number
  private _running = false
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
    const path = findPathAdjacent(this.world, this.position, node.position)
    if (path === null) return false
    this.path = path
    this._action = new GatherAction(node)
    return true
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
    const path = findPathAdjacent(this.world, this.position, patch.position)
    if (path === null) return false
    this.path = path
    this._action = new PlantAction(patch, seedItemId)
    return true
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
    const path = findPathAdjacent(this.world, this.position, patch.position)
    if (path === null) return false
    this.path = path
    this._action = new HarvestAction(patch)
    return true
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
    const path = findPathAdjacent(this.world, this.position, npc.position)
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
    this._nextAttackTick = tick + this.equipment.weaponSpeed()
  }

  /**
   * Start picking up a ground item: queues a walk to the item's tile and
   * sets a PickUpAction (walk-then-act). Returns false when the tile is
   * unreachable. Inventory space is checked on arrival (the pickup tick),
   * emitting `actionFailed: inventory_full` when nothing fits.
   */
  pickUp(item: GroundItem): boolean {
    const path = findPath(this.world, this.position, { x: item.x, y: item.y })
    if (path === null) return false
    this.path = path
    this._action = new PickUpAction(item)
    return true
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
    const path = findPathAdjacent(this.world, this.position, source.position)
    if (path === null) return false
    this.path = path
    this._action = new CookAction(recipe, source)
    return true
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
    const path = findPathAdjacent(this.world, this.position, source.position)
    if (path === null) return false
    this.path = path
    this._action = new SmeltAction(recipe, source)
    return true
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
    const path = findPathAdjacent(this.world, this.position, source.position)
    if (path === null) return false
    this.path = path
    this._action = new ForgeAction(recipe, source)
    return true
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
    const path = findPathAdjacent(this.world, this.position, source.position)
    if (path === null) return false
    this.path = path
    this._action = new TanAction(recipe, source)
    return true
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
    const path = findPathAdjacent(this.world, this.position, booth.position)
    if (path === null) return false
    this.path = path
    this._action = new OpenBankAction(booth)
    return true
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
    const path = findPathAdjacent(this.world, this.position, counter.position)
    if (path === null) return false
    this.path = path
    this._action = new OpenShopAction(counter)
    return true
  }

  /** JSON-safe snapshot of the player, for save/load. */
  serialize(): PlayerSave {
    return {
      x: this._x,
      y: this._y,
      running: this._running,
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
    this._attackStyle = save.attackStyle
    this.skills.restore(save.skills)
    this.inventory.restore(save.inventory)
    this.equipment.restore(save.equipment)
    // Prayers are transient (never saved): always load with none active.
    this.prayers.reset()
  }

  /**
   * Advance one tick: walk 1 tile (2 when running) along the queued path,
   * or tick the current action when idle. Called by Game.tick — not UI code.
   */
  update(game: Game): void {
    if (this.path.length > 0) {
      const steps = this._running ? 2 : 1
      for (let i = 0; i < steps && this.path.length > 0; i++) {
        const next = this.path.shift() as Vec2
        this._x = next.x
        this._y = next.y
      }
      this.events.emit('playerMoved', { x: this._x, y: this._y })
      return
    }
    if (this._action) {
      const stillActive = this._action.onTick(game)
      if (!stillActive) this._action = null
    }
  }
}
