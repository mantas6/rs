// Firemaking fire: two stacked cones (outer flame + inner glow) parked on a
// tile; call updateFireFlicker once per frame to animate.
import * as THREE from 'three'
import type { Fire } from '../../engine'
import { tileGroup, type SpriteResources } from './resources'

/** Flame cones on the fire's tile, tagged for picking. */
export function createFireMesh(res: SpriteResources, fire: Fire): THREE.Group {
  const group = tileGroup(fire.position.x, fire.position.y)
  group.add(res.mesh(res.geo(new THREE.ConeGeometry(0.3, 0.6, 8)), 0xe25822, 0.3))
  group.add(res.mesh(res.geo(new THREE.ConeGeometry(0.15, 0.4, 8)), 0xffb347, 0.45))
  return group
}

/** Flicker the flame height; phase-shifted per tile so fires desync. */
export function updateFireFlicker(group: THREE.Group, fire: Fire, now: number): void {
  group.scale.y = 1 + 0.12 * Math.sin(now / 90 + fire.position.x * 7 + fire.position.y * 13)
}
