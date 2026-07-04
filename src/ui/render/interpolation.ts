// Tick interpolation: the engine only ever knows whole tiles and moves on
// 600ms ticks, so the renderer glides each entity between its previous and
// current tile per frame for smooth motion. This is a pure UI concern.
//
// Timing uses performance.now() (same clock the rAF loop reads), so the
// interpolator is a self-contained bit of state the GameRenderer owns.
import { TICK_MS, type Npc, type Vec2 } from '../../engine'
import type { MoverLerp } from './constants'
import { clamp, lerp } from './math'

export class MoverInterpolator {
  private readonly movers = new Map<object, MoverLerp>()
  /** performance.now() timestamp of the most recent engine tick snapshot. */
  lastTickAt = performance.now()

  /** Shift current → previous for every mover; runs once per engine tick. */
  snapshotMovers(player: Vec2, npcs: readonly Npc[]): void {
    this.lastTickAt = performance.now()
    this.track(player, player.x, player.y)
    for (const npc of npcs) {
      if (npc.alive) this.track(npc, npc.x, npc.y)
      else this.movers.delete(npc) // Snap into place on respawn.
    }
  }

  private track(key: object, x: number, y: number): void {
    const state = this.movers.get(key)
    if (!state) {
      this.movers.set(key, { px: x, py: y, cx: x, cy: y })
      return
    }
    state.px = state.cx
    state.py = state.cy
    state.cx = x
    state.cy = y
    // Teleports (death respawn etc.) snap instead of gliding across the map.
    if (Math.max(Math.abs(state.cx - state.px), Math.abs(state.cy - state.py)) > 3) {
      state.px = state.cx
      state.py = state.cy
    }
  }

  /** The raw lerp record for a mover (for animation pose/walking checks). */
  mover(key: object): MoverLerp | undefined {
    return this.movers.get(key)
  }

  /** 0→1 phase through the current tick at this instant. */
  tickPhase(now: number): number {
    return clamp((now - this.lastTickAt) / TICK_MS, 0, 1)
  }

  /** Interpolated tile-space position of a mover at this instant. */
  moverPos(key: object, x: number, y: number): { x: number; y: number } {
    const state = this.movers.get(key)
    if (!state) return { x, y }
    const t = clamp((performance.now() - this.lastTickAt) / TICK_MS, 0, 1)
    return { x: lerp(state.px, state.cx, t), y: lerp(state.py, state.cy, t) }
  }

  /** World XZ (tile center) of a mover's current interpolated position. */
  entityWorldPos(key: object, x: number, y: number): { x: number; z: number } {
    const pos = this.moverPos(key, x, y)
    return { x: pos.x + 0.5, z: pos.y + 0.5 }
  }
}
