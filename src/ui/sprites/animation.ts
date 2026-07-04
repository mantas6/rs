// Shared procedural-animation helpers for sprite updaters. Everything here
// is purely visual: driven by performance.now() timestamps from the
// renderer's rAF loop. No engine state is ever read or mutated here.

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

/** Sine oscillation: `amplitude * sin(2π * now / periodMs + phase)`. */
export function swing(now: number, periodMs: number, amplitude: number, phase = 0): number {
  return amplitude * Math.sin((now / periodMs) * Math.PI * 2 + phase)
}

/** 0 → 1 progress of an effect started at `startedAt` over `durationMs`. */
export function progress01(now: number, startedAt: number, durationMs: number): number {
  return clamp01((now - startedAt) / durationMs)
}

/** 1 → 0 falloff of an effect started at `startedAt` over `durationMs`. */
export function decay01(now: number, startedAt: number, durationMs: number): number {
  return 1 - progress01(now, startedAt, durationMs)
}

export function easeOutCubic(t: number): number {
  const inv = 1 - clamp01(t)
  return 1 - inv * inv * inv
}

/**
 * Triangle pulse over [0, 1]: rises to 1 at `peak`, back to 0 at 1.
 * Used for strike-and-recover motions (chops, attack swings).
 */
export function strike(t: number, peak = 0.3): number {
  const clamped = clamp01(t)
  return clamped < peak ? clamped / peak : 1 - (clamped - peak) / (1 - peak)
}

/**
 * Yaw (radians) so a +Z-facing model at tile `from` looks toward tile `to`
 * (tile y maps to world z). Returns null when the tiles coincide.
 */
export function yawToward(
  from: { x: number; y: number },
  to: { x: number; y: number },
): number | null {
  const dx = to.x - from.x
  const dz = to.y - from.y
  if (dx === 0 && dz === 0) return null
  return Math.atan2(dx, dz)
}

/** Move `current` toward `target` along the shortest arc by `maxStep`. */
export function approachAngle(current: number, target: number, maxStep: number): number {
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  if (Math.abs(delta) <= maxStep) return target
  return current + Math.sign(delta) * maxStep
}
