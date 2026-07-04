// Decorative bush: a low cluster of leafy blobs (low-poly icosahedrons) in a
// few green shades. Rigid enough to read as a shrub; a whisper of sway keeps
// it from looking dead. See foliage.ts for the FoliagePart contract.
import * as THREE from 'three'
import { pick, type FoliagePart } from './foliage'

const BUSH_GREENS = [0x3f7d38, 0x4f9a44, 0x356b30, 0x5ba64d]

/** Build one bush as 3–5 clustered leaf blobs. */
export function bushParts(rng: () => number): FoliagePart[] {
  const parts: FoliagePart[] = []
  const blobs = 3 + Math.floor(rng() * 3)
  for (let i = 0; i < blobs; i++) {
    const r = 0.16 + rng() * 0.12
    const geometry = new THREE.IcosahedronGeometry(r, 0)
    const angle = rng() * Math.PI * 2
    const dist = rng() * 0.16
    geometry.translate(Math.cos(angle) * dist, r * 0.8 + rng() * 0.14, Math.sin(angle) * dist)
    parts.push({ geometry, color: pick(rng, BUSH_GREENS), sway: 0.02 })
  }
  return parts
}
