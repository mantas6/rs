// Chicken: small off-white cube.
import * as THREE from 'three'
import type { SpriteResources } from './resources'
import type { NpcVariant } from './npcMesh'

export function createChickenMesh(res: SpriteResources): NpcVariant {
  const object = res.mesh(res.geo(new THREE.BoxGeometry(0.32, 0.32, 0.32)), 0xf5f0e6, 0.18)
  return { object, barHeight: 0.6 }
}
