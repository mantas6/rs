// Decorative crate: a wooden supply box with a darker frame and lid. Town
// dressing stacked against building walls (see scenery.ts). Built in local
// space, base at y = 0, centred on the origin. Rigid (no sway). See foliage.ts
// for the FoliagePart contract.
import * as THREE from 'three'
import type { FoliagePart } from './foliage'
import { WOOD, WOOD_DARK, WOOD_LIGHT } from './stall'

/** A box geometry centred at the given local position. */
function box(w: number, h: number, d: number, y: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d)
  geometry.translate(0, y, 0)
  return geometry
}

/** Build one crate: light plank body, a darker lid and a corner post frame. */
export function crateParts(rng: () => number): FoliagePart[] {
  const s = 0.4 + rng() * 0.12
  const h = s * (0.85 + rng() * 0.2)
  return [
    { geometry: box(s, h, s, h / 2), color: WOOD_LIGHT },
    { geometry: box(s + 0.03, h * 0.14, s + 0.03, h - h * 0.05), color: WOOD },
    // Four corner posts read as a slatted crate frame.
    { geometry: box(0.05, h, s, h / 2).translate(s / 2 - 0.025, 0, 0), color: WOOD_DARK },
    { geometry: box(0.05, h, s, h / 2).translate(-s / 2 + 0.025, 0, 0), color: WOOD_DARK },
  ]
}
