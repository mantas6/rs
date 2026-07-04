// Decorative signpost: a short post carrying a light wooden notice board. Town
// dressing stood by building entrances (see scenery.ts). Built in local space,
// base at y = 0, centred on the origin. Rigid (no sway). See foliage.ts for the
// FoliagePart contract.
import * as THREE from 'three'
import type { FoliagePart } from './foliage'
import { WOOD, WOOD_DARK, WOOD_LIGHT } from './stall'

/** Build one signpost: a dark post, a light board and a thin frame rail. */
export function signpostParts(): FoliagePart[] {
  const post = new THREE.CylinderGeometry(0.045, 0.045, 0.72, 8)
  post.translate(0, 0.36, 0)
  const board = new THREE.BoxGeometry(0.42, 0.24, 0.05)
  board.translate(0, 0.6, 0)
  const rail = new THREE.BoxGeometry(0.46, 0.05, 0.06)
  rail.translate(0, 0.74, 0)
  return [
    { geometry: post, color: WOOD_DARK },
    { geometry: board, color: WOOD_LIGHT },
    { geometry: rail, color: WOOD },
  ]
}
