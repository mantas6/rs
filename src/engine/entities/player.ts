import type { EquipmentSlot } from '../../content/types'
import type { EventBus } from '../core/eventBus'
import type { Game } from '../core/game'
import { Equipment } from '../systems/equipment'
import { Inventory } from '../systems/inventory'
import { Skills } from '../systems/skills'
import { findPath } from '../world/pathfinding'
import type { World } from '../world/tileMap'
import type { Vec2 } from '../world/vec2'

/**
 * A tick-driven activity the player is performing (chopping, fighting, ...).
 * Set via `player.setAction(...)`; ticked only while the player is not
 * moving. Starting to walk cancels the current action.
 */
export interface PlayerAction {
  /** Called once per tick while active. Return false when finished. */
  onTick(game: Game): boolean
}

export class Player {
  readonly skills: Skills
  readonly inventory: Inventory
  readonly equipment: Equipment

  private _x: number
  private _y: number
  private _running = false
  private _action: PlayerAction | null = null
  /** Remaining tiles to step through, in order. */
  private path: Vec2[] = []

  constructor(
    private readonly world: World,
    private readonly events: EventBus,
    start: Vec2,
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
