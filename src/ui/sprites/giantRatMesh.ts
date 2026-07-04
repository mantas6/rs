// Giant rat: long low gray box.
import * as THREE from 'three'
import type { SpriteResources } from './resources'
import type { NpcVariant } from './npcMesh'

export function createGiantRatMesh(res: SpriteResources): NpcVariant {
  const object = res.mesh(res.geo(new THREE.BoxGeometry(0.36, 0.28, 0.68)), 0x8d8d8d, 0.16)
  return { object, barHeight: 0.6 }
}
