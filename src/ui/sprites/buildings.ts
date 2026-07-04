// Building layer: turns the bare grey walls into readable buildings — pitched
// thatch roofs, timber-framed plaster walls and simple door frames — layered
// ON TOP of the terrain meshes groundTiles.ts already builds.
//
// UI-only (src/ui/) and fully derived from the walkability grid, so the engine
// and every save stay untouched. A "building" is exactly what groundTiles calls
// a floored room: an enclosed region that contains a functional world object
// (bank, shop, range, furnace, anvil, tannery). We reuse groundTiles'
// `computeFloorKeys` for that set and split it into 4-connected components —
// one component per building interior footprint.
//
// Nothing here is pickable: the renderer adds the returned group straight to
// the scene (never to the raycast list), leaving the existing stone/floor
// InstancedMeshes as the sole pick source, so walk-to / pickTile are unchanged.
// Geometry is built once; only each roof's `visible` flag is toggled per frame
// (OSRS-style roof removal — the roof over the tile you stand on is hidden so
// you can see inside). Every choice is deterministic (bounds + tile coords,
// never Math.random), so the town looks identical on every render.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { World } from '../../engine'
import { computeFloorKeys, isStone, STONE_HEIGHT } from './groundTiles'
import type { SpriteResources, TilePos } from './resources'
import { WOOD_DARK } from './stall'

/** Off-screen thatch texture resolution (power-of-two so mipmaps generate). */
const TEX_SIZE = 128
/** Warm plaster infill for timber-framed building walls. */
const PLASTER = 0xe3d3ac
/** Roof eaves overhang past the walls, in tiles. */
const ROOF_OVERHANG = 0.35

/** The four orthogonal steps used by every tile-set traversal here. */
const ORTHO: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// ---- Pure detection helpers (unit-tested; no Three.js / DOM) ----

/** One building's interior footprint: its floor tiles and their bounding box. */
export interface BuildingFootprint {
  /** Tile keys (y*width + x) of every interior floor tile. */
  keys: Set<number>
  tiles: TilePos[]
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Split the floored-room set (see groundTiles.computeFloorKeys) into connected
 * buildings. A 4-connected flood over the floor keys groups the tiles of each
 * separate room, so the castle courtyard and the kitchen become two distinct
 * footprints. Deterministic: floor keys come from a deterministic BFS and the
 * component order follows their (stable) insertion order.
 */
export function detectBuildings(world: World): BuildingFootprint[] {
  const width = world.width
  const floor = computeFloorKeys(world)
  const visited = new Set<number>()
  const buildings: BuildingFootprint[] = []

  for (const start of floor) {
    if (visited.has(start)) continue
    const keys = new Set<number>()
    const tiles: TilePos[] = []
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    const queue = [start]
    visited.add(start)
    while (queue.length > 0) {
      const k = queue.pop()!
      const x = k % width
      const y = (k - x) / width
      keys.add(k)
      tiles.push({ x, y })
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const [dx, dy] of ORTHO) {
        const nk = (y + dy) * width + (x + dx)
        if (floor.has(nk) && !visited.has(nk)) {
          visited.add(nk)
          queue.push(nk)
        }
      }
    }
    buildings.push({ keys, tiles, minX, maxX, minY, maxY })
  }
  return buildings
}

/**
 * The stone wall tiles that border a building interior: any wall tile
 * orthogonally adjacent to a footprint floor tile. These are the walls we dress
 * as timber-framed plaster — the coop / cow-field fences (walls with no floor
 * behind them) are deliberately excluded and stay as raw grey cobble.
 */
export function buildingWallKeys(world: World, buildings: readonly BuildingFootprint[]): Set<number> {
  const width = world.width
  const walls = new Set<number>()
  for (const b of buildings) {
    for (const { x, y } of b.tiles) {
      for (const [dx, dy] of ORTHO) {
        const nx = x + dx
        const ny = y + dy
        if (isStone(world, nx, ny)) walls.add(ny * width + nx)
      }
    }
  }
  return walls
}

/** A detected doorway: the threshold tile plus the outward (inside→outside) dir. */
export interface BuildingDoor {
  x: number
  y: number
  /** Unit step pointing from the interior out through the doorway. */
  dx: number
  dy: number
}

/**
 * Detect clean, one-tile-wide doorways: a walkable tile that sits in a
 * building's wall run (flanked by two building-wall tiles on one axis) with the
 * interior on one perpendicular side and an open, non-wall tile on the other —
 * the way in. This catches both floored thresholds (like the kitchen door,
 * which the flood fills because a wall sits just outside it) and grass
 * thresholds. Wider gate gaps (e.g. the castle's 3-wide gate) have no flanking
 * walls on their middle tiles, so they stay unframed. `dx/dy` points from the
 * interior outward through the opening.
 */
export function detectDoors(
  world: World,
  buildings: readonly BuildingFootprint[],
  wallKeys: ReadonlySet<number>,
): BuildingDoor[] {
  const width = world.width
  const floorAll = new Set<number>()
  for (const b of buildings) for (const k of b.keys) floorAll.add(k)

  const isWall = (x: number, y: number): boolean => wallKeys.has(y * width + x)
  const isFloor = (x: number, y: number): boolean => floorAll.has(y * width + x)

  const doors = new Map<number, BuildingDoor>()
  const consider = (x: number, y: number): void => {
    const k = y * width + x
    if (doors.has(k) || !world.isWalkable(x, y)) return
    // Opening across the X axis: the wall run is vertical (flanks N & S).
    if (isWall(x, y - 1) && isWall(x, y + 1)) {
      if (isFloor(x + 1, y) && !isFloor(x - 1, y) && !isWall(x - 1, y)) {
        doors.set(k, { x, y, dx: -1, dy: 0 })
        return
      }
      if (isFloor(x - 1, y) && !isFloor(x + 1, y) && !isWall(x + 1, y)) {
        doors.set(k, { x, y, dx: 1, dy: 0 })
        return
      }
    }
    // Opening across the Y axis: the wall run is horizontal (flanks E & W).
    if (isWall(x - 1, y) && isWall(x + 1, y)) {
      if (isFloor(x, y + 1) && !isFloor(x, y - 1) && !isWall(x, y - 1)) {
        doors.set(k, { x, y, dx: 0, dy: -1 })
        return
      }
      if (isFloor(x, y - 1) && !isFloor(x, y + 1) && !isWall(x, y + 1)) {
        doors.set(k, { x, y, dx: 0, dy: 1 })
      }
    }
  }

  // Candidates: every floor tile and its orthogonal neighbours (a door tile is
  // either floored, like the kitchen threshold, or a grass tile beside floor).
  const seen = new Set<number>()
  const visit = (x: number, y: number): void => {
    const k = y * width + x
    if (seen.has(k)) return
    seen.add(k)
    consider(x, y)
  }
  for (const k of floorAll) {
    const x = k % width
    const y = (k - x) / width
    visit(x, y)
    for (const [dx, dy] of ORTHO) visit(x + dx, y + dy)
  }
  return [...doors.values()]
}

// ---- Geometry helpers ----

/**
 * A gabled roof as one non-indexed BufferGeometry: a triangular prism (ridge
 * along local +X) with both sloped faces and both gable end triangles, plus
 * planar UVs (~1 unit per world unit) so the thatch texture tiles at a sane
 * scale. Base plane sits at y = 0 (the caller lifts it to the wall top).
 */
function makeGableRoofGeometry(length: number, base: number, height: number): THREE.BufferGeometry {
  const hl = length / 2 + ROOF_OVERHANG
  const hb = base / 2 + ROOF_OVERHANG
  const H = height

  // Corner (base) + ridge (apex) points.
  const A: [number, number, number] = [-hl, 0, -hb]
  const B: [number, number, number] = [hl, 0, -hb]
  const C: [number, number, number] = [hl, 0, hb]
  const D: [number, number, number] = [-hl, 0, hb]
  const P: [number, number, number] = [-hl, H, 0] // ridge, -X end
  const Q: [number, number, number] = [hl, H, 0] // ridge, +X end

  const slope = Math.hypot(hb, H)
  const positions: number[] = []
  const uvs: number[] = []
  const tri = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    uv0: [number, number],
    uv1: [number, number],
    uv2: [number, number],
  ): void => {
    positions.push(...p0, ...p1, ...p2)
    uvs.push(...uv0, ...uv1, ...uv2)
  }

  // North slope (-Z side): A B Q P.
  tri(A, B, Q, [0, 0], [length, 0], [length, slope])
  tri(A, Q, P, [0, 0], [length, slope], [0, slope])
  // South slope (+Z side): D C Q P.
  tri(D, C, Q, [0, 0], [length, 0], [length, slope])
  tri(D, Q, P, [0, 0], [length, slope], [0, slope])
  // Gable ends (small triangles): west (-X) and east (+X).
  tri(A, P, D, [0, 0], [hb, H], [base, 0])
  tri(B, C, Q, [0, 0], [base, 0], [hb, H])

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

/** Straw-thatch texture: warm base with combed vertical streaks + speckle. */
function makeThatchTexture(res: SpriteResources): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createLinearGradient(0, 0, 0, TEX_SIZE)
  grad.addColorStop(0, '#c79a4e')
  grad.addColorStop(1, '#9c6f34')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // A deterministic PRNG so the thatch pattern is identical every build.
  let a = 0x1f83d9ab >>> 0
  const rng = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Combed straw: many short vertical strokes of varying straw tone.
  for (let i = 0; i < 900; i++) {
    const x = rng() * TEX_SIZE
    const y = rng() * TEX_SIZE
    const len = 6 + rng() * 16
    const tone = Math.floor(150 + rng() * 70)
    ctx.strokeStyle = `rgba(${tone}, ${Math.floor(tone * 0.8)}, ${Math.floor(tone * 0.42)}, ${0.25 + rng() * 0.3})`
    ctx.lineWidth = 1 + rng()
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rng() - 0.5) * 2, y + len)
    ctx.stroke()
  }
  // Darker horizontal binding lines (the ties across a thatch course).
  ctx.strokeStyle = 'rgba(70, 46, 20, 0.35)'
  ctx.lineWidth = 2
  for (let i = 1; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(0, (TEX_SIZE * i) / 4)
    ctx.lineTo(TEX_SIZE, (TEX_SIZE * i) / 4)
    ctx.stroke()
  }

  const texture = res.texture(new THREE.CanvasTexture(canvas))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

// ---- Assembly ----

export interface BuildingsView {
  /** All building geometry; added straight to the scene (never pickable). */
  group: THREE.Group
  /**
   * One roof mesh per building, each tagged with `userData.footprint`
   * (Set<number> of interior tile keys). The renderer hides the roof whose
   * footprint contains the player's tile so you can see inside (roof removal).
   */
  roofs: THREE.Mesh[]
}

/**
 * Build the static building layer for the world: dressed walls, pitched thatch
 * roofs and door frames. All geometry is created once; every geometry/material/
 * texture is tracked by `res` so the renderer's single dispose() frees it.
 */
export function createBuildings(res: SpriteResources, world: World): BuildingsView {
  const group = new THREE.Group()
  const roofs: THREE.Mesh[] = []

  const buildings = detectBuildings(world)
  const wallKeys = buildingWallKeys(world, buildings)
  const doors = detectDoors(world, buildings, wallKeys)
  const width = world.width

  // --- Timber-framed plaster wall dressing (merged by colour) ---
  // Layered over the existing pickable stone boxes (which stay put): a plaster
  // panel that hides the grey cobble, dark timber corner posts and a top beam.
  const byColor = new Map<number, THREE.BufferGeometry[]>()
  const bucket = (color: number, g: THREE.BufferGeometry): void => {
    const list = byColor.get(color)
    if (list) list.push(g)
    else byColor.set(color, [g])
  }
  const boxAt = (
    color: number,
    sx: number,
    sy: number,
    sz: number,
    cx: number,
    cy: number,
    cz: number,
  ): void => {
    const g = new THREE.BoxGeometry(sx, sy, sz)
    g.translate(cx, cy, cz)
    bucket(color, g)
  }

  for (const wallKey of wallKeys) {
    const wx = wallKey % width
    const wy = (wallKey - wx) / width
    const cx = wx + 0.5
    const cz = wy + 0.5
    // Plaster panel: slightly proud of the 1×STONE_HEIGHT×1 stone box so it
    // fully hides the cobble texture (opaque, no z-fight since it sits outside).
    boxAt(PLASTER, 1.04, STONE_HEIGHT, 1.04, cx, STONE_HEIGHT / 2, cz)
    // Dark top beam.
    boxAt(WOOD_DARK, 1.08, 0.14, 1.08, cx, STONE_HEIGHT - 0.05, cz)
    // Four timber corner posts.
    for (const ox of [-0.47, 0.47]) {
      for (const oz of [-0.47, 0.47]) {
        boxAt(WOOD_DARK, 0.14, STONE_HEIGHT, 0.14, cx + ox, STONE_HEIGHT / 2, cz + oz)
      }
    }
  }

  // --- Door frames (dark timber posts + lintel) at clean 1-wide doorways ---
  for (const door of doors) {
    const cx = door.x + 0.5
    const cz = door.y + 0.5
    // Perpendicular unit (the wall run's axis) for the two posts.
    const px = door.dy
    const pz = door.dx
    const postH = STONE_HEIGHT + 0.15
    for (const s of [-0.42, 0.42]) {
      boxAt(WOOD_DARK, 0.16, postH, 0.16, cx + px * s, postH / 2, cz + pz * s)
    }
    // Lintel spanning the opening along the perpendicular axis.
    const lintelX = px !== 0 ? 1.0 : 0.24
    const lintelZ = pz !== 0 ? 1.0 : 0.24
    boxAt(WOOD_DARK, lintelX, 0.16, lintelZ, cx, postH, cz)
  }

  // Fold each colour bucket into one static, non-pickable mesh.
  for (const [color, geos] of byColor) {
    const merged = mergeGeometries(geos, false)
    for (const g of geos) g.dispose()
    if (!merged) continue
    res.geo(merged)
    group.add(new THREE.Mesh(merged, res.mat(color)))
  }

  // --- Roofs: one pitched thatch roof per building, auto-hidden when inside ---
  if (buildings.length > 0) {
    const roofMat = res.matBy(
      'buildingRoof',
      () =>
        new THREE.MeshLambertMaterial({
          map: makeThatchTexture(res),
          side: THREE.DoubleSide,
        }),
    )
    for (const b of buildings) {
      const w = b.maxX - b.minX + 1
      const d = b.maxY - b.minY + 1
      const centerX = b.minX + w / 2
      const centerZ = b.minY + d / 2
      // Ridge runs along the longer span; the peak scales with the short span
      // (capped) so big courtyards don't get an absurdly tall roof.
      const ridgeAlongX = w >= d
      const length = ridgeAlongX ? w : d
      const span = ridgeAlongX ? d : w
      const height = Math.min(2.4, span * 0.35 + 0.6)
      const geometry = res.geo(makeGableRoofGeometry(length, span, height))
      const mesh = new THREE.Mesh(geometry, roofMat)
      if (!ridgeAlongX) mesh.rotation.y = Math.PI / 2
      mesh.position.set(centerX, STONE_HEIGHT, centerZ)
      mesh.userData.footprint = b.keys
      group.add(mesh)
      roofs.push(mesh)
    }
  }

  return { group, roofs }
}
