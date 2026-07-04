// Floating combat damage numbers. Held in a plain array (never pickable),
// parented to their own scene group so they never intercept tile picks. Each
// splat follows its entity, rises and fades, then is reaped.
import * as THREE from 'three'
import type { Npc } from '../../engine'
import { disposeHitsplat, updateHitsplat, type HitsplatView } from '../sprites'

/**
 * A live combat hitsplat plus what it follows. `npc` is the damaged NPC (its
 * interpolated position is tracked while alive; the splat freezes at the last
 * spot once it dies/despawns), or null when the splat sits above the player.
 * `x`/`z` cache the last world position so a frozen splat keeps rising in place.
 */
interface ActiveHitsplat {
  view: HitsplatView
  npc: Npc | null
  x: number
  z: number
}

export class HitsplatManager {
  private readonly hitsplats: ActiveHitsplat[] = []
  /** Scene group holding every live splat sprite. */
  readonly root = new THREE.Group()

  /** Register a freshly-created splat, parenting its sprite to the root. */
  add(view: HitsplatView, npc: Npc | null, x: number, z: number): void {
    this.root.add(view.sprite)
    this.hitsplats.push({ view, npc, x, z })
  }

  /**
   * Follow, rise/fade and reap the live splats. Player splats track the
   * player; NPC splats track the NPC while alive and freeze at their last
   * spot once it dies/despawns (so they don't jump to a respawn tile).
   */
  update(
    now: number,
    playerPos: () => { x: number; z: number },
    npcPos: (npc: Npc) => { x: number; z: number },
  ): void {
    for (let i = this.hitsplats.length - 1; i >= 0; i--) {
      const h = this.hitsplats[i]
      if (!h.npc) {
        const p = playerPos()
        h.x = p.x
        h.z = p.z
      } else if (h.npc.alive) {
        const p = npcPos(h.npc)
        h.x = p.x
        h.z = p.z
      }
      if (!updateHitsplat(h.view, now, h.x, h.z)) {
        this.root.remove(h.view.sprite)
        disposeHitsplat(h.view)
        this.hitsplats.splice(i, 1)
      }
    }
  }

  /** Free every live splat's GPU resources and clear the list. */
  dispose(): void {
    for (const h of this.hitsplats) {
      this.root.remove(h.view.sprite)
      disposeHitsplat(h.view)
    }
    this.hitsplats.length = 0
  }
}
