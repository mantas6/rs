// OSRS-style floating damage number ("hitsplat"): a billboarded THREE.Sprite
// carrying a small canvas texture with the damage drawn on a coloured disc
// (red for a hit, blue for a 0/miss). The renderer spawns one above the entity
// that took damage on each `damageDealt` event, then calls `updateHitsplat`
// every frame to make it rise and fade over ~1s before disposing it.
//
// Purely visual: like the other sprite updaters this is driven by
// performance.now() timestamps from the renderer's rAF loop, never engine
// state. Textures/materials are per-instance (not pooled via SpriteResources),
// so callers must call `disposeHitsplat` when a splat expires or the renderer
// is torn down.
import * as THREE from 'three'
import { clamp01, easeOutCubic } from './animation'

/** Colours matching OSRS: red damage disc, blue "0" for a miss/splash. */
const HIT_COLOR = '#c0392b'
const MISS_COLOR = '#3aa6d0'

/** Off-screen canvas resolution (square; scaled down to world units). */
const CANVAS_SIZE = 128
/** How long a hitsplat lives before it is removed (ms). */
export const HITSPLAT_LIFETIME_MS = 1000
/** World-space height the splat drifts upward over its lifetime. */
const RISE = 0.8
/** World size of the sprite quad. */
const SPRITE_SCALE = 0.62

/** A single live hitsplat plus the GPU resources it owns. */
export interface HitsplatView {
  sprite: THREE.Sprite
  texture: THREE.CanvasTexture
  material: THREE.SpriteMaterial
  /** performance.now() timestamp the splat was spawned at. */
  spawnedAt: number
  /** World-space Y the splat starts at (it rises from here). */
  baseHeight: number
}

/** Render the damage number onto a fresh canvas texture. */
function drawTexture(damage: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')!
  const miss = damage <= 0
  const center = CANVAS_SIZE / 2

  // Coloured disc backdrop.
  ctx.fillStyle = miss ? MISS_COLOR : HIT_COLOR
  ctx.beginPath()
  ctx.arc(center, center, center - 6, 0, Math.PI * 2)
  ctx.fill()

  // White number with a soft dark shadow for legibility.
  ctx.font = 'bold 74px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label = miss ? '0' : String(damage)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillText(label, center + 2, center + 4)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, center, center + 2)

  return new THREE.CanvasTexture(canvas)
}

/**
 * Build a hitsplat for `damage` (0 → blue miss splat). `baseHeight` is the
 * world-space Y to float above the entity's feet; `spawnedAt` is the
 * performance.now() timestamp used to drive the rise/fade.
 */
export function createHitsplat(damage: number, baseHeight: number, spawnedAt: number): HitsplatView {
  const texture = drawTexture(damage)
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false, // Always readable, drawn over the world like OSRS.
    depthWrite: false,
    toneMapped: false, // UI overlay: keep the disc/number crisp, not tone-mapped.
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(SPRITE_SCALE, SPRITE_SCALE, SPRITE_SCALE)
  sprite.renderOrder = 999
  return { sprite, texture, material, spawnedAt, baseHeight }
}

/**
 * Advance one hitsplat for a frame at world position (x, z): rise with an
 * ease-out and fade the last third of its life. Returns false once the
 * lifetime has elapsed (the caller should remove + dispose it then).
 */
export function updateHitsplat(view: HitsplatView, now: number, x: number, z: number): boolean {
  const t = (now - view.spawnedAt) / HITSPLAT_LIFETIME_MS
  if (t >= 1) return false
  view.sprite.position.set(x, view.baseHeight + easeOutCubic(t) * RISE, z)
  view.material.opacity = t < 0.66 ? 1 : clamp01((1 - t) / 0.34)
  return true
}

/** Free the texture + material a hitsplat owns. */
export function disposeHitsplat(view: HitsplatView): void {
  view.texture.dispose()
  view.material.dispose()
}
