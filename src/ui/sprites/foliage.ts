// Shared building blocks for the decorative scenery scattered across the
// world (see scenery.ts): bushes, flowers, grass tufts and ferns. Each foliage
// file exports a "parts" factory that describes ONE plant as a handful of
// low-poly primitives in local space (base at y = 0, growing up the +Y axis,
// centred on x = z = 0). scenery.ts transforms and merges many of them into a
// few draw calls, so these builders never touch materials or the scene graph.
//
// UI-only (src/ui/) and fully deterministic: every random choice comes from a
// per-plant seeded PRNG (createRng), never Math.random, so the same seed always
// produces the same world.
import * as THREE from 'three'

/**
 * One primitive of a plant. `sway` is a per-part amplitude (0 = rigid): the
 * scatterer bakes it into a per-vertex `aSway` attribute scaled by the vertex
 * height, so tips sway while the base stays planted. Geometry is in local space
 * and ownership passes to the caller (scenery.ts transforms/merges/disposes it).
 */
export interface FoliagePart {
  geometry: THREE.BufferGeometry
  color: number
  sway?: number
}

/** Small fast PRNG (mulberry32) so each plant's shape is reproducible. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Pick a deterministic element from a list using the plant's PRNG. */
export function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]
}
