// NPC visual dispatcher: picks the per-id variant mesh (falling back to a
// purple humanoid capsule for unknown ids) and attaches the health bar.
import * as THREE from 'three'
import type { Npc } from '../../engine'
import { createChickenMesh } from './chickenMesh'
import { createCowMesh } from './cowMesh'
import { createGiantRatMesh } from './giantRatMesh'
import { createGoblinMesh } from './goblinMesh'
import { createHealthBar } from './healthBar'
import { tileGroup, type SpriteResources } from './resources'

const NPC_FALLBACK = 0xc678dd

/** Body mesh plus how high above it the health bar floats. */
export interface NpcVariant {
  object: THREE.Object3D
  barHeight: number
}

export interface NpcView {
  group: THREE.Group
  hpBar: THREE.Group
  hpFill: THREE.Mesh
}

function createVariant(res: SpriteResources, npcId: string): NpcVariant {
  switch (npcId) {
    case 'chicken':
      return createChickenMesh(res)
    case 'cow':
      return createCowMesh(res)
    case 'giant_rat':
      return createGiantRatMesh(res)
    case 'goblin':
      return createGoblinMesh(res)
    default: {
      const object = res.mesh(
        res.geo(new THREE.CapsuleGeometry(0.2, 0.4, 4, 10)),
        NPC_FALLBACK,
        0.42,
      )
      return { object, barHeight: 1 }
    }
  }
}

/** Full NPC view: picking-tagged tile group + body + billboarded hp bar. */
export function createNpcMesh(res: SpriteResources, npc: Npc): NpcView {
  const group = tileGroup(npc.x, npc.y)
  const { object, barHeight } = createVariant(res, npc.def.id)
  group.add(object)
  const { hpBar, hpFill } = createHealthBar(res, barHeight)
  group.add(hpBar)
  return { group, hpBar, hpFill }
}
