// Hover indicator: yellow line-loop outlining the tile under the cursor.
import * as THREE from 'three'
import type { SpriteResources } from './resources'

export function createHoverOutline(res: SpriteResources): THREE.LineLoop {
  const points = [
    new THREE.Vector3(-0.5, 0, -0.5),
    new THREE.Vector3(0.5, 0, -0.5),
    new THREE.Vector3(0.5, 0, 0.5),
    new THREE.Vector3(-0.5, 0, 0.5),
  ]
  const geometry = res.geo(new THREE.BufferGeometry().setFromPoints(points))
  const material = new THREE.LineBasicMaterial({ color: 0xf4d03f })
  res.trackMaterial('hoverLine', material)
  const outline = new THREE.LineLoop(geometry, material)
  outline.position.y = 0.04
  outline.visible = false
  return outline
}
