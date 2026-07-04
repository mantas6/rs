// Decorative barrel: a squat wooden cask bound by two dark hoops with a light
// lid. Town dressing propped against building walls (see scenery.ts). Built in
// local space, base at y = 0, centred on the origin. Rigid (no sway). See
// foliage.ts for the FoliagePart contract.
import * as THREE from 'three'
import type { FoliagePart } from './foliage'
import { WOOD, WOOD_DARK, WOOD_LIGHT } from './stall'

/** A short cylinder (staves, hoop or lid) at a given height. */
function ring(radius: number, height: number, y: number): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 12)
  geometry.translate(0, y, 0)
  return geometry
}

/** Build one barrel: staved body, two iron-dark hoops and a light top. */
export function barrelParts(rng: () => number): FoliagePart[] {
  const h = 0.44 + rng() * 0.12
  const r = 0.2 + rng() * 0.04
  return [
    { geometry: ring(r, h, h / 2), color: WOOD },
    { geometry: ring(r + 0.015, h * 0.12, h * 0.28), color: WOOD_DARK },
    { geometry: ring(r + 0.015, h * 0.12, h * 0.72), color: WOOD_DARK },
    { geometry: ring(r - 0.02, 0.04, h), color: WOOD_LIGHT },
  ]
}
