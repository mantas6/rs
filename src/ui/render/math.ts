// Small pure numeric/input helpers shared by the renderer modules. No engine
// state, no THREE — trivially unit-testable.

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Centroid + finger spread of a two-finger touch, for orbit/pinch. */
export function touchInfo(e: TouchEvent): { x: number; y: number; dist: number } {
  const a = e.touches[0]
  const b = e.touches[1]
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
    dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
  }
}
