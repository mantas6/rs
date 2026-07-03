/**
 * Event map for the game. Later systems extend this via declaration merging:
 *
 *   declare module '../core/eventBus' {
 *     interface GameEvents {
 *       xpGained: { skill: string; amount: number }
 *     }
 *   }
 *
 * Alternatively, EventBus is generic and can be instantiated with any map.
 */
export interface GameEvents {
  /** Emitted at the end of every game tick. */
  tick: { tick: number }
  /** Emitted when the player's tile position changes during a tick. */
  playerMoved: { x: number; y: number }
}

export type EventHandler<TPayload> = (payload: TPayload) => void

/** Minimal strongly-typed event bus. */
export class EventBus<TEvents = GameEvents> {
  private readonly handlers = new Map<keyof TEvents, Set<EventHandler<any>>>()

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler)
    return () => this.off(event, handler)
  }

  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler)
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    // Iterate a snapshot so handlers may unsubscribe during emit.
    for (const handler of [...set]) handler(payload)
  }
}
