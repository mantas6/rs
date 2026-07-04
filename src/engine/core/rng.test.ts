import { describe, expect, it } from 'vitest'
import { Rng } from './rng'

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(12345)
    const b = new Rng(12345)
    const seqA = Array.from({ length: 100 }, () => a.nextFloat())
    const seqB = Array.from({ length: 100 }, () => b.nextFloat())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1)
    const b = new Rng(2)
    const seqA = Array.from({ length: 100 }, () => a.nextFloat())
    const seqB = Array.from({ length: 100 }, () => b.nextFloat())
    expect(seqA).not.toEqual(seqB)
  })

  it('nextFloat stays in [0, 1)', () => {
    const rng = new Rng(999)
    for (let i = 0; i < 10_000; i++) {
      const v = rng.nextFloat()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('nextInt respects inclusive bounds over many iterations', () => {
    const rng = new Rng(42)
    const seen = new Set<number>()
    for (let i = 0; i < 10_000; i++) {
      const v = rng.nextInt(3, 7)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
      expect(Number.isInteger(v)).toBe(true)
      seen.add(v)
    }
    // All values in the range should appear over 10k draws.
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7])
  })

  it('nextInt handles a single-value range', () => {
    const rng = new Rng(7)
    for (let i = 0; i < 100; i++) {
      expect(rng.nextInt(5, 5)).toBe(5)
    }
  })

  it('nextInt rejects invalid bounds', () => {
    const rng = new Rng(1)
    expect(() => rng.nextInt(5, 4)).toThrow()
    expect(() => rng.nextInt(0.5, 2)).toThrow()
  })

  it('chance(0) is never true and chance(1) is always true', () => {
    const rng = new Rng(555)
    for (let i = 0; i < 1000; i++) {
      expect(rng.chance(0)).toBe(false)
      expect(rng.chance(1)).toBe(true)
    }
  })

  it('chance(p) approximates p over many trials', () => {
    const rng = new Rng(2024)
    let hits = 0
    const trials = 100_000
    for (let i = 0; i < trials; i++) {
      if (rng.chance(0.25)) hits++
    }
    expect(hits / trials).toBeGreaterThan(0.23)
    expect(hits / trials).toBeLessThan(0.27)
  })

  it('clone continues the same sequence independently', () => {
    const original = new Rng(31337)
    original.nextFloat()
    original.nextFloat()

    const copy = original.clone()
    const fromOriginal = Array.from({ length: 20 }, () => original.nextFloat())
    const fromCopy = Array.from({ length: 20 }, () => copy.nextFloat())
    expect(fromCopy).toEqual(fromOriginal)
  })

  it('getState/setState resume the exact sequence (save/load)', () => {
    const rng = new Rng(123)
    for (let i = 0; i < 10; i++) rng.nextFloat()

    const state = rng.getState()
    const expected = Array.from({ length: 20 }, () => rng.nextFloat())

    const restored = new Rng(999) // seed is irrelevant once state is set
    restored.setState(state)
    const resumed = Array.from({ length: 20 }, () => restored.nextFloat())
    expect(resumed).toEqual(expected)
  })

  it('fork is deterministic and independent of the parent', () => {
    const parentA = new Rng(9000)
    const parentB = new Rng(9000)
    const childA = parentA.fork()
    const childB = parentB.fork()

    const seqA = Array.from({ length: 20 }, () => childA.nextFloat())
    const seqB = Array.from({ length: 20 }, () => childB.nextFloat())
    expect(seqA).toEqual(seqB)

    // Parents remain in lockstep after forking.
    expect(parentA.nextFloat()).toBe(parentB.nextFloat())
  })
})
