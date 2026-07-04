// Cooking range: dark red box parked on its tile.
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'

export function createCookingRangeMesh(res: SpriteResources, x: number, y: number): THREE.Group {
  const group = tileGroup(x, y)
  group.add(res.mesh(res.geo(new THREE.BoxGeometry(0.9, 1, 0.9)), 0x7a2318, 0.5))
  return group
}
