// Dropped item: yellow octahedron that slowly spins on its tile.
import * as THREE from 'three'
import type { GroundItem } from '../../engine'
import { tileGroup, type SpriteResources } from './resources'

export function createGroundItemMesh(res: SpriteResources, item: GroundItem): THREE.Group {
  const group = tileGroup(item.x, item.y)
  group.add(res.mesh(res.geo(new THREE.OctahedronGeometry(0.16)), 0xf4d03f, 0.2))
  return group
}

/** Spin the item; `now` is a milliseconds timestamp. */
export function updateGroundItemSpin(group: THREE.Object3D, now: number): void {
  group.rotation.y = now / 800
}
