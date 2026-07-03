import type { EquipmentSlot } from '../../content/types'
import type { EventBus } from '../core/eventBus'
import type { Game } from '../core/game'
import { OpenBankAction } from '../systems/bank'
import { AttackAction, type AttackStyle } from '../systems/combat'
import { CookAction, type CookingSource, getCookingRecipe, validateCook } from '../systems/cooking'
import { Equipment } from '../systems/equipment'
import {
  type FireManager,
  getFiremakingDef,
  LightFireAction,
  validateLightFire,
} from '../systems/firemaking'
import { GatherAction, validateGather } from '../systems/gathering'
import { Inventory } from '../systems/inventory'
import { getItemDef } from '../systems/itemRegistry'
import { Skills } from '../systems/skills'
import {
  GROUND_ITEM_DESPAWN_TICKS,
  type GroundItem,
  type GroundItemManager,
  PickUpAction,
} from '../world/groundItems'
import { findPath, findPathAdjacent } from '../world/pathfinding'
import type { ResourceNode } from '../world/resourceNode'
import type { World } from '../world/tileMap'
import type { Vec2 } from '../world/vec2'
import type { WorldObject } from '../world/worldObject'
import type { Npc } from './npc'

/**
 * A tick-driven activity the player is performing (chopping, fighting, ...).
 * Set via `player.setAction(...)`; ticked only while the player is not
 * moving. Starting to walk cancels the current action.
 */
export interface PlayerAction {
  /** Called once per tick while active. Return false when finished. */
  onTick(game: Game): boolean
}

/** Why eating an inventory item failed. */
export type ConsumeFailReason = 'not_food'

// Player consumable events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /** Emitted when the player eats food (the item is already consumed). */
    itemEaten: { itemId: string; healed: number; hpAfter: number }
    /** Emitted when the player drops an inventory stack on the ground. */
    itemDropped: { itemId: string; quantity: number; x: number; y: number }
  }
}

export class Player {
  readonly skills: Skills
  readonly inventory: Inventory
  readonly equipment: Equipment

  private _x: number
  private _y: number
  private _running = false
  private _action: PlayerAction | null = null
  private _attackStyle: AttackStyle = 'accurate'
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
