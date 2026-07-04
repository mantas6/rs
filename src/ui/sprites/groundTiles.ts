// Terrain rendering. The engine only knows two tile kinds — walkable and
// blocked (see engine/world/tileMap.ts) — so this file turns that flat
// boolean grid into a richer-looking surface entirely on the UI side:
//
//   - walkable tiles      → flat grass planes (mottled grass texture)
//   - building interiors  → flat flagstone planes (dressed-stone floor)
//   - thick blocked tiles → flat water planes (rippling water texture)
//   - thin blocked tiles  → raised stone boxes (cracked-rock texture)
//
// "Thick" vs "thin" is a purely visual classification: a blocked tile that
// belongs to a 2×2 (or larger) solid block of blocked tiles reads as a body
// of water (the river), while 1-tile-thick blocked lines read as walls. This
// keeps water/wall telling without any engine or content change.
//
// "Building interior" is likewise derived, not authored: a walkable tile that
// is walled-in on every side AND lies inside the room that holds a functional
// world object (bank, shop, range, furnace, anvil) is floored with flagstone,
// so the castle courtyard and kitchen read as furnished rooms rather than bare
// grass patches. Fenced fields/pens (no object inside) stay grass.
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
/** Floor sits a hair above the grass so room thresholds never z-fight. */
const FLOOR_Y = 0.012

/** A texture whose UV offset the renderer scrolls each frame (flowing water). */
export interface WaterAnimation {
  texture: THREE.Texture
}

export interface GroundTiles {
  groundMesh: THREE.InstancedMesh
  floorMesh: THREE.InstancedMesh
  waterMesh: THREE.InstancedMesh
  stoneMesh: THREE.InstancedMesh
  groundTiles: TilePos[]
  floorTiles: TilePos[]
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

/**
 * Dressed-flagstone floor for building interiors: a warm sandstone base laid
 * out as regular flagstones with darker mortar seams and a little wear grain,
 * so a floored room reads as clearly "indoors" against the green grass and the
 * cooler grey wall stone.
 */
function makeFloorTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!
  const rng = mulberry32(0x27d4eb2f)

  ctx.fillStyle = '#b8a07a'
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // Flagstones: a grid of tan slabs, each a slightly different shade, set into
  // darker mortar. A per-row half-tile offset breaks up the grid into courses.
  const cols = 4
  const rows = 4
  const cw = TEX_SIZE / cols
  const rh = TEX_SIZE / rows
  ctx.fillStyle = '#6f5c3f'
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE) // mortar bed shows through the gaps
  for (let ry = 0; ry < rows; ry++) {
    const shift = (ry % 2) * (cw / 2)
    for (let cx = -1; cx < cols; cx++) {
      const x = cx * cw + shift
      const y = ry * rh
      const tone = Math.floor(150 + rng() * 55)
      ctx.fillStyle = `rgb(${tone + 24}, ${tone + 6}, ${Math.floor(tone * 0.72)})`
      const gap = 3 + rng() * 2
      ctx.fillRect(x + gap, y + gap, cw - gap * 2, rh - gap * 2)
    }
  }

  // Wear grain + flecks so the slabs are not flat colour.
  for (let i = 0; i < 900; i++) {
    const bright = rng() > 0.5
    ctx.fillStyle = bright
      ? `rgba(226, 210, 176, ${0.08 + rng() * 0.12})`
      : `rgba(96, 78, 52, ${0.08 + rng() * 0.16})`
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

/** A stone wall tile: blocked, but not part of a water body — a room's wall. */
function isStone(world: World, x: number, y: number): boolean {
  return isBlocked(world, x, y) && !isWaterTile(world, x, y)
}

/** How far a cardinal scan looks for an enclosing wall (rooms are small). */
const FLOOR_MAX_WALL_DIST = 13
/** How far a floor spreads outward from a building's world object. */
const FLOOR_SPREAD_DEPTH = 40

/**
 * True when (x, y) sits inside a room: a stone wall is found within
 * FLOOR_MAX_WALL_DIST tiles in every cardinal direction. Water is not a wall
 * (so riverside grass never reads as indoors) and each scan stops at the first
 * wall/water/edge it meets. Open-air tiles fail (no wall on some side), which
 * is what stops floors leaking out through doorways.
 */
function isEnclosed(world: World, x: number, y: number): boolean {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const [dx, dy] of dirs) {
    let found = false
    for (let d = 1; d <= FLOOR_MAX_WALL_DIST; d++) {
      const nx = x + dx * d
      const ny = y + dy * d
      if (!world.inBounds(nx, ny)) break
      if (isWaterTile(world, nx, ny)) break
      if (isStone(world, nx, ny)) {
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
}

/**
 * The set of tile keys (y*width + x) that should be floored as a building
 * interior. A multi-source BFS spreads out from every world object, but expands
 * ONLY into enclosed tiles (see `isEnclosed`): the walk therefore fills the room
 * a functional object lives in (castle courtyard, kitchen) yet stops dead at the
 * doorway — the threshold tile is open on one side, so it fails the enclosure
 * test and the spread can never leak outdoors or hop into a neighbouring fenced
 * field/pen that holds no object. Purely derived — no engine or content data.
 */
function computeFloorKeys(world: World): Set<number> {
  const key = (x: number, y: number): number => y * world.width + x
  const floor = new Set<number>()
  const visited = new Set<number>()
  let frontier: TilePos[] = []
  for (const obj of world.objects) {
    const k = key(obj.position.x, obj.position.y)
    if (!visited.has(k)) {
      visited.add(k)
      frontier.push({ x: obj.position.x, y: obj.position.y })
    }
  }

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (let depth = 0; depth < FLOOR_SPREAD_DEPTH && frontier.length > 0; depth++) {
    const next: TilePos[] = []
    for (const { x, y } of frontier) {
      if (isEnclosed(world, x, y)) floor.add(key(x, y))
      for (const [dx, dy] of dirs) {
        const nx = x + dx
        const ny = y + dy
        if (!world.inBounds(nx, ny)) continue
        const nk = key(nx, ny)
        if (visited.has(nk)) continue
        if (isStone(world, nx, ny) || isWaterTile(world, nx, ny)) continue
        // Only walk into enclosed tiles: this confines the fill to the room and
        // makes the open doorway threshold a natural, grass-floored boundary.
        if (!isEnclosed(world, nx, ny)) continue
        visited.add(nk)
        next.push({ x: nx, y: ny })
      }
    }
    frontier = next
  }
  return floor
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
  const floorKeys = computeFloorKeys(world)
  const grass: TilePos[] = []
  const floor: TilePos[] = []
  const water: TilePos[] = []
  const stone: TilePos[] = []
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (isBlocked(world, x, y)) {
        if (isWaterTile(world, x, y)) water.push({ x, y })
        else stone.push({ x, y })
      } else if (floorKeys.has(y * world.width + x)) {
        floor.push({ x, y })
      } else {
        grass.push({ x, y })
      }
    }
  }

  const grassTex = res.texture(makeGrassTexture(anisotropy))
  const floorTex = res.texture(makeFloorTexture(anisotropy))
  const waterTex = res.texture(makeWaterTexture(anisotropy))
  const stoneTex = res.texture(makeStoneTexture(anisotropy))

  const plane = res.geo(new THREE.PlaneGeometry(1, 1))
  plane.rotateX(-Math.PI / 2)
  const floorPlane = res.geo(new THREE.PlaneGeometry(1, 1))
  floorPlane.rotateX(-Math.PI / 2)
  const waterPlane = res.geo(new THREE.PlaneGeometry(1, 1))
  waterPlane.rotateX(-Math.PI / 2)
  const box = res.geo(new THREE.BoxGeometry(1, STONE_HEIGHT, 1))

  const groundMesh = new THREE.InstancedMesh(
    plane,
    new THREE.MeshLambertMaterial({ map: grassTex }),
    grass.length,
  )
  // Flat flagstone floor for building interiors; a hair above grass so the
  // shoreline/thresholds never z-fight where a room meets the open ground.
  const floorMesh = new THREE.InstancedMesh(
    floorPlane,
    new THREE.MeshLambertMaterial({ map: floorTex }),
    floor.length,
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

  floor.forEach((tile, i) => {
    m.setPosition(tile.x + 0.5, FLOOR_Y, tile.y + 0.5)
    floorMesh.setMatrixAt(i, m)
    tintInstance(floorMesh, i, tile, scratch)
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

  for (const mesh of [groundMesh, floorMesh, waterMesh, stoneMesh]) {
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  // Materials here are created directly (not via res.mat); track them so the
  // shared dispose() frees them alongside the textures.
  res.trackMaterial('groundGrass', groundMesh.material as THREE.Material)
  res.trackMaterial('groundFloor', floorMesh.material as THREE.Material)
  res.trackMaterial('groundWater', waterMesh.material as THREE.Material)
  res.trackMaterial('groundStone', stoneMesh.material as THREE.Material)

  return {
    groundMesh,
    floorMesh,
    waterMesh,
    stoneMesh,
    groundTiles: grass,
    floorTiles: floor,
    waterTiles: water,
    stoneTiles: stone,
    water: { texture: waterTex },
  }
}

/** Drift the water texture so the river surface appears to flow. */
export function updateWaterRipple(water: WaterAnimation, now: number): void {
  water.texture.offset.set((now * 0.00003) % 1, (now * 0.00006) % 1)
}
