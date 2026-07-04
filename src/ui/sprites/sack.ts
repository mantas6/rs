// Decorative grain sack: a plump burlap bag with a tied-off top. Town dressing
// heaped by shop counters and kitchen walls (see scenery.ts). Built in local
// space, base at y = 0, centred on the origin. Rigid (no sway). See foliage.ts
// for the FoliagePart contract.
import * as THREE from 'three'
import type { FoliagePart } from './foliage'

/** Warm burlap tones. */
const BURLAP = 0xcdb488
const BURLAP_DARK = 0xa88f63

/** Build one sack: a squashed body blob with a small pinched-top knot. */
export function sackParts(rng: () => number): FoliagePart[] {
  const r = 0.17 + rng() * 0.05
  const body = new THREE.IcosahedronGeometry(r, 0)
  body.scale(1, 1.25, 1)
  body.translate(0, r * 1.1, 0)
  const knot = new THREE.IcosahedronGeometry(r * 0.42, 0)
  knot.translate(0, r * 2.2, 0)
  return [
    { geometry: body, color: BURLAP },
    { geometry: knot, color: BURLAP_DARK },
  ]
}
