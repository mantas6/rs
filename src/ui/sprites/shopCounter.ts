// Shop counter: purple box parked on its tile (the general store).
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'

export function createShopCounterMesh(res: SpriteResources, x: number, y: number): THREE.Group {
  const group = tileGroup(x, y)
  group.add(res.mesh(res.geo(new THREE.BoxGeometry(0.9, 1, 0.9)), 0x7b4fa8, 0.5))
  return group
}
