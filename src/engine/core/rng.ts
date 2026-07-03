/**
 * Deterministic seedable PRNG (mulberry32).
 *
 * All randomness in the engine MUST flow through an Rng instance so that
 * game runs are fully reproducible from a seed. Never use Math.random().
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    // Coerce to uint32 so any integer seed is valid.
    this.state = seed >>> 0
  }

  /** Next raw 32-bit unsigned integer. */
  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }

  /** Uniform float in [0, 1). */
  nextFloat(): number {
    return this.nextUint32() / 4294967296
  }

  /** Uniform integer in [minInclusive, maxInclusive]. */
  nextInt(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error('nextInt bounds must be integers')
    }
    if (maxInclusive < minInclusive) {
      throw new Error('nextInt: maxInclusive must be >= minInclusive')
    }
    const span = maxInclusive - minInclusive + 1
    return minInclusive + Math.floor(this.nextFloat() * span)
  }

  /** True with probability p (p <= 0 => never, p >= 1 => always). */
  chance(p: number): boolean {
    return this.nextFloat() < p
  }

  /**
   * Create a new independent Rng seeded from this one.
   * Advances this Rng's state by one step.
   */
  fork(): Rng {
    return new Rng(this.nextUint32())
  }

  /** Exact copy that continues the same sequence without affecting this one. */
  clone(): Rng {
    const copy = new Rng(0)
    copy.state = this.state
    return copy
  }
}
