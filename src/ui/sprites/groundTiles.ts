// Terrain rendering. The engine only knows two tile kinds — walkable and
// blocked (see engine/world/tileMap.ts) — so this file turns that flat
// boolean grid into a richer-looking surface entirely on the UI side:
//
//   - walkable tiles      → flat grass planes (mottled grass texture)
//   - thick blocked tiles → flat water planes (rippling water texture)
//   - thin blocked tiles  → raised stone boxes (cracked-rock texture)
//
// "Thick" vs "thin" is a purely visual classification: a blocked tile that
// belongs to a 2×2 (or larger) solid block of blocked tiles reads as a body
// of water (the river), while 1-tile-thick blocked lines read as walls. This
// keeps water/wall telling without any engine or content change.
//
// Every kind is a single InstancedMesh sharing one material, so the whole
// map is a handful of draw calls. Per-tile variety comes from `instanceColor`
// (a deterministic hash of the tile coordinate — stable across renders, never
// Math.random) multiplying a shared procedural CanvasTexture. The
// instance-index → tile arrays let the renderer map raycast hits back to map
// coordinates for picking.
import * as THREE from 'three'
import type { World } from '../../engine'
import type { SpriteResources, TilePos } from './resources'

/** Off-screen texture resolution (power-of-two so mipmaps generate). */
const TEX_SIZE = 256
/** Height/top of a stone wall box (must match the renderer's hover offset). */
const STONE_HEIGHT = 0.8
/** Water sits a hair below the grass so shorelines read as a gentle dip. */
const WATER_Y = -0.03

/** A texture whose UV offset the renderer scrolls each frame (flowing water). */
export interface WaterAnimation {
  texture: THREE.Texture
}

export interface GroundTiles {
  groundMesh: THREE.InstancedMesh
  waterMesh: THREE.InstancedMesh
  stoneMesh: THREE.InstancedMesh
  groundTiles: TilePos[]
  waterTiles: TilePos[]
  stoneTiles: TilePos[]
  water: WaterAnimation
}

// ---- Deterministic helpers (UI-only, but kept stable across renders) ----

/** Small fast PRNG so procedural texture drawing is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable hash of a tile coordinate → [0, 1); used for per-tile tinting. */
function hash2(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Finish a canvas as an sRGB, mip-mapped, anisotropic repeating texture. */
function finishTexture(canvas: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = Math.max(1, anisotropy)
  texture.needsUpdate = true
  return texture
}

// ---- Procedural tile textures (drawn once, shared by every instance) ----

/** Mottled grass: green base with lighter/darker speckle and a few blades. */
function makeGrassTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!
  const rng = mulberry32(0x9e3779b1)

  ctx.fillStyle = '#7dab5a'
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // Soft clumps of colour so the field is not a uniform sheet.
  for (let i = 0; i < 220; i++) {
    const x = rng() * TEX_SIZE
    const y = rng() * TEX_SIZE
    const r = 6 + rng() * 22
    const shade = Math.floor(150 + rng() * 90)
    const green = Math.floor(120 + rng() * 70)
    ctx.fillStyle = `rgba(${shade - 40}, ${green}, ${Math.floor(60 + rng() * 40)}, 0.16)`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Fine speckle (dry/bright flecks) for grain up close.
  for (let i = 0; i < 1400; i++) {
    const x = rng() * TEX_SIZE
    const y = rng() * TEX_SIZE
    const bright = rng() > 0.5
    ctx.fillStyle = bright
      ? `rgba(200, 220, 150, ${0.10 + rng() * 0.16})`
      : `rgba(60, 90, 40, ${0.10 + rng() * 0.18})`
    ctx.fillRect(x, y, 1 + rng() * 1.5, 1 + rng() * 1.5)
  }

  // A scattering of short grass blades.
  ctx.lineWidth = 1
  for (let i = 0; i < 260; i++) {
    const x = rng() * TEX_SIZE
    const y = rng() * TEX_SIZE
    const len = 3 + rng() * 5
    ctx.strokeStyle = `rgba(90, 140, 60, ${0.25 + rng() * 0.25})`
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rng() - 0.5) * 2, y - len)
    ctx.stroke()
  }

  return finishTexture(canvas, anisotropy)
}

/**
 * Rippling water: blue base with horizontal highlight bands (an integer
 * number of wavelengths so the texture tiles seamlessly when its offset is
 * scrolled) plus a few sparkle specks.
 */
function makeWaterTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!
  const rng = mulberry32(0x2545f491)

  const grad = ctx.createLinearGradient(0, 0, 0, TEX_SIZE)
  grad.addColorStop(0, '#4f8fd0')
  grad.addColorStop(1, '#3a72b4')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // Sine ripple bands. `waves` is an integer so left/right and top/bottom
  // edges line up, keeping the scroll seamless.
  const waves = 5
  for (let y = 0; y < TEX_SIZE; y++) {
    const shimmer = Math.sin((y / TEX_SIZE) * waves * Math.PI * 2)
    const alpha = 0.05 + 0.07 * (shimmer * 0.5 + 0.5)
    ctx.fillStyle = `rgba(190, 225, 255, ${alpha})`
    ctx.fillRect(0, y, TEX_SIZE, 1)
  }
  for (let x = 0; x < TEX_SIZE; x++) {
    const shimmer = Math.sin((x / TEX_SIZE) * waves * Math.PI * 2)
    const alpha = 0.03 + 0.05 * (shimmer * 0.5 + 0.5)
    ctx.fillStyle = `rgba(210, 235, 255, ${alpha})`
    ctx.fillRect(x, 0, 1, TEX_SIZE)
  }

  // Sparkle glints.
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.12 + rng() * 0.22})`
    ctx.fillRect(rng() * TEX_SIZE, rng() * TEX_SIZE, 1 + rng() * 1.5, 1 + rng() * 1.5)
  }

  return finishTexture(canvas, anisotropy)
}

/** Cracked stone: grey cobble cells with dark seams and light highlights. */
function makeStoneTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!
  const rng = mulberry32(0x85ebca6b)

  ctx.fillStyle = '#8b909b'
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // Irregular cobble cells of varying grey.
  const cells = 6
  const step = TEX_SIZE / cells
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const g = Math.floor(120 + rng() * 70)
      ctx.fillStyle = `rgba(${g}, ${g + 4}, ${g + 12}, 0.55)`
      const pad = 2 + rng() * 3
      ctx.fillRect(cx * step + pad, cy * step + pad, step - pad * 2, step - pad * 2)
    }
  }

  // Dark cracks + light grain speckle.
  ctx.strokeStyle = 'rgba(40, 42, 50, 0.5)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 40; i++) {
    ctx.beginPath()
    ctx.moveTo(rng() * TEX_SIZE, rng() * TEX_SIZE)
    ctx.lineTo(rng() * TEX_SIZE, rng() * TEX_SIZE)
    ctx.stroke()
  }
  for (let i = 0; i < 900; i++) {
    const bright = rng() > 0.5
    ctx.fillStyle = bright
      ? `rgba(210, 214, 224, ${0.08 + rng() * 0.14})`
      : `rgba(50, 54, 64, ${0.08 + rng() * 0.16})`
    ctx.fillRect(rng() * TEX_SIZE, rng() * TEX_SIZE, 1 + rng() * 1.5, 1 + rng() * 1.5)
  }

  return finishTexture(canvas, anisotropy)
}

// ---- Tile classification + mesh assembly ----

/** True when the base map blocks (x, y) — the tiles rendered as water/stone. */
function isBlocked(world: World, x: number, y: number): boolean {
  if (!world.inBounds(x, y)) return false
  // Node/object tiles render as grass (their mesh sits on top), so exclude them.
  return !world.isWalkable(x, y) && !world.nodeAt(x, y) && !world.objectAt(x, y)
}

/**
 * A blocked tile reads as water when it is part of a 2×2 (or larger) solid
 * block of blocked tiles — i.e. a thick body of terrain — as opposed to a
 * 1-tile-thick wall line. Checks the four 2×2 squares that contain (x, y).
 */
function isWaterTile(world: World, x: number, y: number): boolean {
  const squares = [
    [0, 0],
    [-1, 0],
    [0, -1],
    [-1, -1],
  ]
  for (const [ox, oy] of squares) {
    if (
      isBlocked(world, x + ox, y + oy) &&
      isBlocked(world, x + ox + 1, y + oy) &&
      isBlocked(world, x + ox, y + oy + 1) &&
      isBlocked(world, x + ox + 1, y + oy + 1)
    ) {
      return true
    }
  }
  return false
}

/**
 * Stable near-white per-tile tint for instance `i`. The shared texture carries
 * each surface's colour; this only nudges brightness and a slight warm/cool
 * bias per tile (deterministic hash — never Math.random) so the field is not a
 * uniform sheet. Values stay ≤ 1 so instances only ever darken the texture.
 */
function tintInstance(
  mesh: THREE.InstancedMesh,
  i: number,
  tile: TilePos,
  scratch: THREE.Color,
): void {
  const h = hash2(tile.x, tile.y)
  const h2 = hash2(tile.y * 31 + 7, tile.x * 17 + 3)
  const brightness = 0.8 + h * 0.2 // 0.80 .. 1.00
  const warm = (h2 - 0.5) * 0.06 // slight red-vs-blue shift
  scratch.setRGB(
    Math.min(1, brightness + warm),
    Math.min(1, brightness),
    Math.min(1, brightness - warm),
  )
  mesh.setColorAt(i, scratch)
}

/**
 * Build the terrain: grass planes for walkable tiles, water planes for thick
 * blocked bodies, and raised stone boxes for thin blocked walls. Each kind is
 * one InstancedMesh with a shared procedural texture + per-tile tint.
 */
export function createGroundTiles(
  res: SpriteResources,
  world: World,
  anisotropy: number,
): GroundTiles {
  const grass: TilePos[] = []
  const water: TilePos[] = []
  const stone: TilePos[] = []
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (isBlocked(world, x, y)) {
        if (isWaterTile(world, x, y)) water.push({ x, y })
        else stone.push({ x, y })
      } else {
        grass.push({ x, y })
      }
    }
  }

  const grassTex = res.texture(makeGrassTexture(anisotropy))
  const waterTex = res.texture(makeWaterTexture(anisotropy))
  const stoneTex = res.texture(makeStoneTexture(anisotropy))

  const plane = res.geo(new THREE.PlaneGeometry(1, 1))
  plane.rotateX(-Math.PI / 2)
  const waterPlane = res.geo(new THREE.PlaneGeometry(1, 1))
  waterPlane.rotateX(-Math.PI / 2)
  const box = res.geo(new THREE.BoxGeometry(1, STONE_HEIGHT, 1))

  const groundMesh = new THREE.InstancedMesh(
    plane,
    new THREE.MeshLambertMaterial({ map: grassTex }),
    grass.length,
  )
  // Phong gives the flat water a soft sun glint; kept opaque so the open sky
  // behind the map never shows through the river at grazing angles.
  const waterMesh = new THREE.InstancedMesh(
    waterPlane,
    new THREE.MeshPhongMaterial({ map: waterTex, shininess: 60, specular: 0x9fc4e8 }),
    water.length,
  )
  const stoneMesh = new THREE.InstancedMesh(
    box,
    new THREE.MeshLambertMaterial({ map: stoneTex }),
    stone.length,
  )

  const m = new THREE.Matrix4()
  const scratch = new THREE.Color()

  grass.forEach((tile, i) => {
    m.setPosition(tile.x + 0.5, 0, tile.y + 0.5)
    groundMesh.setMatrixAt(i, m)
    tintInstance(groundMesh, i, tile, scratch)
  })

  water.forEach((tile, i) => {
    m.setPosition(tile.x + 0.5, WATER_Y, tile.y + 0.5)
    waterMesh.setMatrixAt(i, m)
    tintInstance(waterMesh, i, tile, scratch)
  })

  stone.forEach((tile, i) => {
    m.setPosition(tile.x + 0.5, STONE_HEIGHT / 2, tile.y + 0.5)
    stoneMesh.setMatrixAt(i, m)
    tintInstance(stoneMesh, i, tile, scratch)
  })

  for (const mesh of [groundMesh, waterMesh, stoneMesh]) {
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  // Materials here are created directly (not via res.mat); track them so the
  // shared dispose() frees them alongside the textures.
  res.trackMaterial('groundGrass', groundMesh.material as THREE.Material)
  res.trackMaterial('groundWater', waterMesh.material as THREE.Material)
  res.trackMaterial('groundStone', stoneMesh.material as THREE.Material)

  return {
    groundMesh,
    waterMesh,
    stoneMesh,
    groundTiles: grass,
    waterTiles: water,
    stoneTiles: stone,
    water: { texture: waterTex },
  }
}

/** Drift the water texture so the river surface appears to flow. */
export function updateWaterRipple(water: WaterAnimation, now: number): void {
  water.texture.offset.set((now * 0.00003) % 1, (now * 0.00006) % 1)
}
