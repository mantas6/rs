// Fishing spot: concentric flat rings on the water (never depletes). The
// rings pulse gently; call updateFishingSpotPulse once per frame.
import * as THREE from 'three'
import type { SpriteResources } from './resources'

/** Ring stack for a fishing spot; `depleted` stays empty (spots persist). */
export function createFishingSpotMesh(
  res: SpriteResources,
): { live: THREE.Group; depleted: THREE.Group } {
  const live = new THREE.Group()
  const depleted = new THREE.Group()

  for (const radius of [0.15, 0.3, 0.45]) {
    const ring = new THREE.Mesh(
      res.geo(new THREE.RingGeometry(radius, radius + 0.05, 24)),
      res.mat(0x4fc3f7, { transparent: true, opacity: 0.8 }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    live.add(ring)
  }

  return { live, depleted }
}

/** Pulse the rings; `now` is a milliseconds timestamp. */
export function updateFishingSpotPulse(live: THREE.Group, now: number): void {
  live.children.forEach((ring, i) => {
    const s = 1 + 0.15 * Math.sin(now / 500 + i)
    ring.scale.set(s, s, 1)
  })
}
