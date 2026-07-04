// Decorative fence segment: two wooden posts joined by a pair of rails. Built
// spanning one tile along the local +X axis and centred on the origin; the
// scatterer (scenery.ts) rotates it onto a tile edge and drops it there, so a
// run of edges reads as a continuous railing. Purely cosmetic — never blocks
// movement or intercepts clicks. See foliage.ts for the FoliagePart contract.
import * as THREE from 'three'
import type { FoliagePart } from './foliage'
import { WOOD, WOOD_DARK } from './stall'

/** A rail box spanning the tile width at a given height. */
function rail(y: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(0.94, 0.06, 0.045)
  geometry.translate(0, y, 0)
  return geometry
}

/** A post box at the given local x offset. */
function post(x: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(0.09, 0.52, 0.09)
  geometry.translate(x, 0.26, 0)
  return geometry
}

/** Build one fence segment: two posts (dark wood) + two rails (mid wood). */
export function fenceParts(): FoliagePart[] {
  return [
    { geometry: post(-0.45), color: WOOD_DARK },
    { geometry: post(0.45), color: WOOD_DARK },
    { geometry: rail(0.2), color: WOOD },
    { geometry: rail(0.4), color: WOOD },
  ]
}
