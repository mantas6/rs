// Cow: brown body box with a cream patch.
import * as THREE from 'three'
import type { SpriteResources } from './resources'
import type { NpcVariant } from './npcMesh'

export function createCowMesh(res: SpriteResources): NpcVariant {
  const object = new THREE.Group()
  object.add(res.mesh(res.geo(new THREE.BoxGeometry(0.5, 0.5, 0.8)), 0x8d6e63, 0.35))
  const patch = res.mesh(res.geo(new THREE.BoxGeometry(0.52, 0.25, 0.3)), 0xf5f0e6, 0.42)
  patch.position.z = 0.15
  object.add(patch)
  return { object, barHeight: 0.9 }
}
