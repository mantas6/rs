// Decorative fern: a low rosette of arched fronds (thin tapered cones leaning
// steeply outward) in a deep forest green. A touch taller and darker than a
// grass tuft, so it reads at the shaded edges of the wood. See foliage.ts for
// the FoliagePart contract.
import * as THREE from 'three'
import { pick, type FoliagePart } from './foliage'

const FERN_GREENS = [0x2f6b2e, 0x357a34, 0x28602a]

/** Build one fern as 5–7 fronds fanning out from the base. */
export function fernParts(rng: () => number): FoliagePart[] {
  const parts: FoliagePart[] = []
  const fronds = 5 + Math.floor(rng() * 3)
  const color = pick(rng, FERN_GREENS)
  for (let i = 0; i < fronds; i++) {
    const length = 0.34 + rng() * 0.2
    const geometry = new THREE.ConeGeometry(0.035, length, 4)
    geometry.translate(0, length / 2, 0)
    // Arch each frond well over to the side, then spin around the rosette.
    geometry.rotateZ(0.5 + rng() * 0.5)
    geometry.rotateY((i / fronds) * Math.PI * 2 + rng() * 0.4)
    parts.push({ geometry, color, sway: 0.05 })
  }
  return parts
}
