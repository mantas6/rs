// Decorative flowers: one or two thin green stems, each topped by a small ring
// of coloured petals around a bright centre. A few colour variants are picked
// deterministically per plant. Stems + heads sway gently. See foliage.ts for
// the FoliagePart contract.
import * as THREE from 'three'
import { pick, type FoliagePart } from './foliage'

const STEM_GREEN = 0x4f8a37
const PETAL_COLORS = [0xd94f5c, 0xf2c94c, 0xf4f1e8, 0x9b6dc4, 0x5b8fd6, 0xe86fa0]
const PETAL_CENTER = 0xf7d24b

/** Build one flower clump as 1–2 stems, each with a petal head. */
export function flowerParts(rng: () => number): FoliagePart[] {
  const parts: FoliagePart[] = []
  const petalColor = pick(rng, PETAL_COLORS)
  const stems = 1 + Math.floor(rng() * 2)
  for (let s = 0; s < stems; s++) {
    const height = 0.3 + rng() * 0.16
    const ox = (rng() - 0.5) * 0.16
    const oz = (rng() - 0.5) * 0.16

    const stem = new THREE.CylinderGeometry(0.012, 0.02, height, 5)
    stem.translate(ox, height / 2, oz)
    parts.push({ geometry: stem, color: STEM_GREEN, sway: 0.06 })

    // Petals: five small flattened blobs ringing the stem top.
    for (let p = 0; p < 5; p++) {
      const petal = new THREE.IcosahedronGeometry(0.05, 0)
      petal.scale(1, 0.5, 1)
      const angle = (p / 5) * Math.PI * 2
      petal.translate(ox + Math.cos(angle) * 0.06, height, oz + Math.sin(angle) * 0.06)
      parts.push({ geometry: petal, color: petalColor, sway: 0.06 })
    }

    const center = new THREE.IcosahedronGeometry(0.035, 0)
    center.translate(ox, height, oz)
    parts.push({ geometry: center, color: PETAL_CENTER, sway: 0.06 })
  }
  return parts
}
