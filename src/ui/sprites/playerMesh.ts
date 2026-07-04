// Player avatar: blue capsule body + cream head on a picking-tagged group.
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'

const PLAYER_BODY = 0x3b6ea5
const PLAYER_HEAD = 0xe8d5b5

export function createPlayerMesh(res: SpriteResources, x: number, y: number): THREE.Group {
  const group = tileGroup(x, y)
  group.add(res.mesh(res.geo(new THREE.CapsuleGeometry(0.25, 0.55, 4, 12)), PLAYER_BODY, 0.55))
  group.add(res.mesh(res.geo(new THREE.SphereGeometry(0.16, 12, 12)), PLAYER_HEAD, 1.1))
  return group
}
