// Tree resource node: trunk + canopy while live, a stump while depleted.
import * as THREE from 'three'
import type { SpriteResources } from './resources'

/** Both looks for a tree node; the renderer toggles their visibility. */
export function createTreeMesh(
  res: SpriteResources,
  treeId: string,
): { live: THREE.Group; depleted: THREE.Group } {
  const live = new THREE.Group()
  const depleted = new THREE.Group()

  const trunk = res.mesh(res.geo(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 8)), 0x4e342e, 0.45)
  const canopyColor = treeId === 'oak_tree' ? 0x1e5e2a : 0x2e7d32
  const canopy = res.mesh(res.geo(new THREE.IcosahedronGeometry(0.6, 1)), canopyColor, 1.25)
  live.add(trunk, canopy)
  depleted.add(res.mesh(res.geo(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 8)), 0x5d4030, 0.125))

  return { live, depleted }
}
