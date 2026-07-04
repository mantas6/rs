// Decorative grass tuft: a handful of thin tapered blades fanning out from a
// point. The tips sway the most (high `sway`), so a field of tufts ripples
// gently. See foliage.ts for the FoliagePart contract.
import * as THREE from 'three'
import { pick, type FoliagePart } from './foliage'

const BLADE_GREENS = [0x6fae4d, 0x5c9a3e, 0x7cbb57, 0x4f8a37]

/** Build one grass tuft as 3–5 thin blades leaning outward. */
export function grassTuftParts(rng: () => number): FoliagePart[] {
  const parts: FoliagePart[] = []
  const blades = 3 + Math.floor(rng() * 3)
  const color = pick(rng, BLADE_GREENS)
  for (let i = 0; i < blades; i++) {
    const height = 0.28 + rng() * 0.22
    const geometry = new THREE.ConeGeometry(0.028, height, 4)
    // Cone origin is its centre; lift so the base sits on the ground.
    geometry.translate(0, height / 2, 0)
    // Lean each blade out a little in a random direction.
    geometry.rotateZ((rng() - 0.5) * 0.5)
    geometry.rotateY(rng() * Math.PI * 2)
    geometry.translate((rng() - 0.5) * 0.14, 0, (rng() - 0.5) * 0.14)
    parts.push({ geometry, color, sway: 0.09 })
  }
  return parts
}
