// Decorative lamp post: a slim dark pole topped by a warm glowing lantern with
// a little cap. Town dressing planted at building corners along the streets
// (see scenery.ts). Built in local space, base at y = 0, centred on the origin.
// Rigid (no sway). See foliage.ts for the FoliagePart contract.
import * as THREE from 'three'
import type { FoliagePart } from './foliage'
import { WOOD_DARK } from './stall'

/** Warm, lit lantern glass. */
const LAMP_GLOW = 0xffd98a

/** A box centred at a local height. */
function box(w: number, h: number, d: number, y: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d)
  geometry.translate(0, y, 0)
  return geometry
}

/** Build one lamp post: pole, glowing lantern box and a dark cap. */
export function lampPostParts(): FoliagePart[] {
  const post = new THREE.CylinderGeometry(0.045, 0.055, 1.0, 8)
  post.translate(0, 0.5, 0)
  return [
    { geometry: post, color: WOOD_DARK },
    { geometry: box(0.17, 0.2, 0.17, 1.05), color: LAMP_GLOW },
    { geometry: box(0.21, 0.05, 0.21, 1.18), color: WOOD_DARK },
  ]
}
