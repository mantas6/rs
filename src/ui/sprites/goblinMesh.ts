// Goblin: green humanoid capsule.
import * as THREE from 'three'
import type { SpriteResources } from './resources'
import type { NpcVariant } from './npcMesh'

export function createGoblinMesh(res: SpriteResources): NpcVariant {
  const object = res.mesh(res.geo(new THREE.CapsuleGeometry(0.2, 0.4, 4, 10)), 0x6ab04c, 0.42)
  return { object, barHeight: 1 }
}
