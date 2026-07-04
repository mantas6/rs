// Mining rock: dodecahedron with an ore-colored speckle while live, a bare
// dark rock while depleted.
import * as THREE from 'three'
import type { SpriteResources } from './resources'

const ORE_SPECKLE: Record<string, number> = {
  copper_rock: 0xc97e3d,
  tin_rock: 0xcfd4dc,
  iron_rock: 0xa04a3c,
}

/** Both looks for a rock node; the renderer toggles their visibility. */
export function createRockMesh(
  res: SpriteResources,
  rockId: string,
): { live: THREE.Group; depleted: THREE.Group } {
  const live = new THREE.Group()
  const depleted = new THREE.Group()

  const rock = res.mesh(res.geo(new THREE.DodecahedronGeometry(0.45)), 0x767676, 0.3)
  rock.scale.y = 0.7
  const speckle = res.mesh(
    res.geo(new THREE.DodecahedronGeometry(0.16)),
    ORE_SPECKLE[rockId] ?? 0xffffff,
    0.55,
  )
  speckle.position.x = 0.12
  live.add(rock, speckle)

  const bare = res.mesh(res.geo(new THREE.DodecahedronGeometry(0.45)), 0x4c4c4c, 0.3)
  bare.scale.y = 0.7
  depleted.add(bare)

  return { live, depleted }
}
