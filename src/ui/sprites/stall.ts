// Shared building blocks for the market-stall style objects (the bank booth
// and the general-store counter). Keeps a common wood palette and the little
// primitive/CanvasTexture helpers both stalls reuse, so each object file only
// has to describe its own arrangement of parts.
//
// UI-only (src/ui/): CanvasTexture drawing touches the DOM canvas API, which
// is fine here — the engine stays pure. Colours are picked to sit happily in
// the brightened daylight palette (warm woods, a bright bank blue, gold).
import * as THREE from 'three'
import type { SpriteResources } from './resources'

// ---- Shared wood/metal palette ----

/** Dark structural wood (posts, counter carcass, chest). */
export const WOOD_DARK = 0x5b3a21
/** Medium plank wood (counter fronts, back panels, crates). */
export const WOOD = 0x8a5a2f
/** Light, sun-caught wood (counter tops, trim, lids). */
export const WOOD_LIGHT = 0xc08f52
/** Coin / clasp gold (also a nod to the old gold bank cube). */
export const GOLD = 0xe0b53d

/** Draws onto a 2D canvas of the given pixel size. */
type CanvasPainter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

// ---- Primitive helpers (solid colour, cached Lambert material) ----

/** A solid-colour box placed at a local position within a stall group. */
export function box(
  res: SpriteResources,
  size: [number, number, number],
  color: number,
  [x, y, z]: [number, number, number],
): THREE.Mesh {
  const mesh = res.mesh(res.geo(new THREE.BoxGeometry(size[0], size[1], size[2])), color, y)
  mesh.position.set(x, y, z)
  return mesh
}

/** A solid-colour cylinder (coins, barrels, hoops) at a local position. */
export function cylinder(
  res: SpriteResources,
  radius: number,
  height: number,
  color: number,
  [x, y, z]: [number, number, number],
  radialSegments = 12,
): THREE.Mesh {
  const geometry = res.geo(new THREE.CylinderGeometry(radius, radius, height, radialSegments))
  const mesh = res.mesh(geometry, color, y)
  mesh.position.set(x, y, z)
  return mesh
}

// ---- Procedural CanvasTexture materials (shared + cached by key) ----

/**
 * A Lambert material whose colour map is a procedurally-drawn CanvasTexture.
 * Cached on the shared resources by `key`, so every stall of a kind reuses one
 * texture + material (created once, freed by SpriteResources.dispose()).
 */
export function texturedMaterial(
  res: SpriteResources,
  key: string,
  size: [number, number],
  paint: CanvasPainter,
): THREE.Material {
  return res.matBy(key, () => {
    const canvas = document.createElement('canvas')
    canvas.width = size[0]
    canvas.height = size[1]
    const ctx = canvas.getContext('2d')!
    paint(ctx, size[0], size[1])
    const texture = res.texture(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return new THREE.MeshLambertMaterial({ map: texture })
  })
}

/**
 * A flat signboard plane carrying a painted CanvasTexture, facing -Z (the
 * front of a stall) so it reads for the player standing in front. Geometry is
 * per-call (tracked/freed); the material/texture are shared by `key`.
 */
export function signPlane(
  res: SpriteResources,
  key: string,
  planeSize: [number, number],
  canvasSize: [number, number],
  pos: [number, number, number],
  paint: CanvasPainter,
): THREE.Mesh {
  const material = texturedMaterial(res, key, canvasSize, paint)
  const geometry = res.geo(new THREE.PlaneGeometry(planeSize[0], planeSize[1]))
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(pos[0], pos[1], pos[2])
  mesh.rotation.y = Math.PI // PlaneGeometry faces +Z; turn it to face the front.
  return mesh
}

/** Rounded-rect path helper for tidy sign borders. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draw a simple gold coin (disc with a rim and a struck mark) at (cx, cy). */
function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.fillStyle = '#f2c94c'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = Math.max(2, r * 0.18)
  ctx.strokeStyle = '#b8862b'
  ctx.stroke()
  ctx.lineWidth = Math.max(1, r * 0.12)
  ctx.beginPath()
  ctx.moveTo(cx, cy - r * 0.45)
  ctx.lineTo(cx, cy + r * 0.45)
  ctx.stroke()
}

/** Painter for the bank banner: gold "BANK" and coins on a bright blue field. */
export const paintBankSign: CanvasPainter = (ctx, w, h) => {
  ctx.fillStyle = '#1e4b8f'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#f2c94c'
  const bankBorder = Math.round(h * 0.09)
  ctx.lineWidth = bankBorder
  roundRect(ctx, bankBorder, bankBorder, w - bankBorder * 2, h - bankBorder * 2, h * 0.16)
  ctx.stroke()

  const coinR = h * 0.18
  drawCoin(ctx, w * 0.12, h * 0.5, coinR)
  drawCoin(ctx, w * 0.88, h * 0.5, coinR)

  ctx.fillStyle = '#f7d968'
  ctx.font = `bold ${Math.round(h * 0.6)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('BANK', w * 0.5, h * 0.56)
}

/** Painter for the shop sign: dark "SHOP" on a light wooden board with grain. */
export const paintShopSign: CanvasPainter = (ctx, w, h) => {
  ctx.fillStyle = '#c9a06a'
  ctx.fillRect(0, 0, w, h)
  // A few horizontal plank grain lines.
  ctx.strokeStyle = 'rgba(90, 58, 33, 0.35)'
  ctx.lineWidth = Math.max(1, h * 0.03)
  for (let i = 1; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(0, (h * i) / 4)
    ctx.lineTo(w, (h * i) / 4)
    ctx.stroke()
  }
  ctx.strokeStyle = '#5b3a21'
  const shopBorder = Math.round(h * 0.08)
  ctx.lineWidth = shopBorder
  roundRect(ctx, shopBorder, shopBorder, w - shopBorder * 2, h - shopBorder * 2, h * 0.14)
  ctx.stroke()

  ctx.fillStyle = '#3b2412'
  ctx.font = `bold ${Math.round(h * 0.62)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SHOP', w * 0.5, h * 0.58)
}

/** Painter for the awning canopy: bold red/cream vertical market stripes. */
export const paintAwningStripes: CanvasPainter = (ctx, w, h) => {
  const stripes = 8
  const stripeW = w / stripes
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#c0392b' : '#f2ede0'
    ctx.fillRect(i * stripeW, 0, stripeW + 1, h)
  }
}
