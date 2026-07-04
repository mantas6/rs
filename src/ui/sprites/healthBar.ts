// Billboarded NPC health bar: red background + left-anchored green fill.
// The renderer scales `hpFill` and copies the camera quaternion each frame
// via updateHealthBar.
import * as THREE from 'three'
import type { SpriteResources } from './resources'

export interface HealthBarView {
  hpBar: THREE.Group
  hpFill: THREE.Mesh
}

/** A hidden health bar floating `barHeight + 0.25` above the entity. */
export function createHealthBar(res: SpriteResources, barHeight: number): HealthBarView {
  const hpBar = new THREE.Group()
  hpBar.position.y = barHeight + 0.25
  const barGeo = res.geo(new THREE.PlaneGeometry(0.8, 0.09))
  const back = new THREE.Mesh(barGeo, res.mat(0xc0392b))
  const fillGeo = res.geo(new THREE.PlaneGeometry(0.8, 0.09))
  fillGeo.translate(0.4, 0, 0) // Anchor at the left edge so scale.x shrinks rightward.
  const fill = new THREE.Mesh(fillGeo, res.mat(0x27ae60))
  fill.position.set(-0.4, 0, 0.001)
  hpBar.add(back, fill)
  hpBar.visible = false
  return { hpBar, hpFill: fill }
}

/** Show the bar when damaged, scale the fill and billboard to the camera. */
export function updateHealthBar(
  view: HealthBarView,
  currentHp: number,
  maxHp: number,
  cameraQuaternion: THREE.Quaternion,
): void {
  view.hpBar.visible = currentHp < maxHp
  if (view.hpBar.visible) {
    view.hpFill.scale.x = Math.max(currentHp / maxHp, 0.001)
    view.hpBar.quaternion.copy(cameraQuaternion)
  }
}
