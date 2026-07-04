// Decorative scenery scatter: foliage (bushes, flowers, grass tufts, ferns),
// riverbank fences, and building props (barrels, crates, sacks, lamp posts and
// signposts) sprinkled across the map to make the world feel alive and to give
// the otherwise-bare buildings some furnishing.
//
// Purely a UI concern (Approach A): the engine and content are untouched. The
// scatter is driven entirely by the tile map the renderer already built —
// grass tiles get foliage, tiles bordering water get railings — and every
// choice comes from a deterministic hash of the tile coordinate (never
// Math.random), so the world looks the same on every render.
//
// Nothing here is pickable: the renderer adds the returned group straight to
// the scene (NOT to the raycast list), so clicks pass through decorations to
// the ground tile beneath and click-to-walk/interact is unaffected. Skipping
// tiles that hold a resource node or world object keeps decor off interactive
// spots (trees, rocks, fishing spots, bank, shop, range).
//
// Performance: every plant/segment is a few low-poly primitives, but they are
// merged by colour into a handful of static meshes (a few draw calls total),
// and all geometries/materials are tracked by SpriteResources for one-shot
// dispose. A cheap vertex-shader sway (one shared uniform) animates the
// foliage tips without any per-frame CPU work.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { World } from '../../engine'
import { barrelParts } from './barrel'
import { bushParts } from './bush'
import { crateParts } from './crate'
import { fenceParts } from './fence'
import { fernParts } from './fern'
import { flowerParts } from './flowers'
import { createRng, type FoliagePart } from './foliage'
import { grassTuftParts } from './grassTuft'
import { lampPostParts } from './lampPost'
import type { SpriteResources, TilePos } from './resources'
import { sackParts } from './sack'
import { signpostParts } from './signpost'

export interface SceneryView {
  /** Root of all decorations; added straight to the scene (never pickable). */
  group: THREE.Group
  /** Shared sway clock; the renderer sets `.value` (seconds) each frame. */
  sway: { value: number }
}

// ---- Deterministic hashing (UI-only, stable across renders) ----

/** Stable 32-bit hash of a tile coordinate + salt. */
function hashInt(x: number, y: number, salt: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt, 2246822519)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/** Stable hash of a tile coordinate + salt in [0, 1). */
function h01(x: number, y: number, salt: number): number {
  return hashInt(x, y, salt) / 4294967296
}

// ---- Sway material (shared uniform, cheap vertex displacement) ----

/**
 * A Lambert material that displaces vertices horizontally by their baked
 * `aSway` amount, phased by world position so neighbouring plants desync.
 * Cached per colour and driven by the shared `sway` uniform, so N foliage
 * meshes sway from a single per-frame uniform write.
 */
function swayMaterial(res: SpriteResources, color: number, sway: { value: number }): THREE.Material {
  return res.matBy(`foliageSway:${color}`, () => {
    const material = new THREE.MeshLambertMaterial({ color })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = sway
      shader.vertexShader =
        'uniform float uTime;\nattribute float aSway;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
    float swayPhase = position.x * 0.8 + position.z * 0.7;
    transformed.x += sin(uTime * 1.6 + swayPhase) * aSway;
    transformed.z += cos(uTime * 1.15 + swayPhase) * aSway * 0.55;`,
        )
    }
    return material
  })
}

// ---- Placement ----

/** The four tile edges, with the rotation + world offset of a fence there. */
const FENCE_EDGES = [
  { dx: 1, dy: 0, rot: Math.PI / 2, ex: 1.0, ez: 0.5 }, // east edge  → runs N–S
  { dx: -1, dy: 0, rot: Math.PI / 2, ex: 0.0, ez: 0.5 }, // west edge  → runs N–S
  { dx: 0, dy: 1, rot: 0, ex: 0.5, ez: 1.0 }, // south edge → runs E–W
  { dx: 0, dy: -1, rot: 0, ex: 0.5, ez: 0.0 }, // north edge → runs E–W
]

/**
 * Build every decoration for the world. `grassTiles` and `waterTiles` are the
 * classified terrain the renderer already computed (see groundTiles.ts), reused
 * here so foliage sits on grass and railings hug the river with the exact same
 * water shape (including natural gaps at the bridge and at fishing spots).
 */
export function createScenery(
  res: SpriteResources,
  world: World,
  grassTiles: readonly TilePos[],
  floorTiles: readonly TilePos[],
  waterTiles: readonly TilePos[],
  stoneTiles: readonly TilePos[],
): SceneryView {
  const sway = { value: 0 }
  const group = new THREE.Group()

  const waterKeys = new Set(waterTiles.map((t) => t.y * world.width + t.x))
  const stoneKeys = new Set(stoneTiles.map((t) => t.y * world.width + t.x))
  // Merge buckets keyed by colour: foliage (swaying) kept apart from the rigid
  // fences and building props so their differing vertex attributes never clash
  // during merge (props/fences carry no baked `aSway`).
  const foliageByColor = new Map<number, THREE.BufferGeometry[]>()
  const fenceByColor = new Map<number, THREE.BufferGeometry[]>()
  const propByColor = new Map<number, THREE.BufferGeometry[]>()

  const bucket = (map: Map<number, THREE.BufferGeometry[]>, color: number, g: THREE.BufferGeometry): void => {
    const list = map.get(color)
    if (list) list.push(g)
    else map.set(color, [g])
  }

  /** Non-index a (possibly indexed) geometry, disposing the original if so. */
  const nonIndexed = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    if (!g.index) return g
    const ng = g.toNonIndexed()
    g.dispose()
    return ng
  }

  const placeFoliage = (
    parts: FoliagePart[],
    rot: number,
    scale: number,
    wx: number,
    wz: number,
  ): void => {
    for (const part of parts) {
      part.geometry.scale(scale, scale, scale)
      part.geometry.rotateY(rot)
      part.geometry.translate(wx, 0, wz)
      const g = nonIndexed(part.geometry)
      // Bake per-vertex sway = height × amplitude (base planted, tips move).
      const pos = g.attributes.position
      const amp = part.sway ?? 0
      const swayAttr = new Float32Array(pos.count)
      for (let i = 0; i < pos.count; i++) swayAttr[i] = Math.max(0, pos.getY(i)) * amp
      g.setAttribute('aSway', new THREE.Float32BufferAttribute(swayAttr, 1))
      bucket(foliageByColor, part.color, g)
    }
  }

  const placeFence = (parts: FoliagePart[], rot: number, wx: number, wz: number): void => {
    for (const part of parts) {
      part.geometry.rotateY(rot)
      part.geometry.translate(wx, 0, wz)
      bucket(fenceByColor, part.color, nonIndexed(part.geometry))
    }
  }

  const placeProp = (parts: FoliagePart[], rot: number, wx: number, wz: number): void => {
    for (const part of parts) {
      part.geometry.rotateY(rot)
      part.geometry.translate(wx, 0, wz)
      bucket(propByColor, part.color, nonIndexed(part.geometry))
    }
  }

  /**
   * Furnish a wall-hugging tile with a building prop. Returns true when one was
   * placed (so foliage skips the tile). Props sit against a neighbouring stone
   * wall — barrels/crates/sacks lean on the wall, lamp posts and signposts
   * stand a touch prouder — so they read as town dressing, not clutter.
   */
  const tryPlaceProp = (x: number, y: number, chance: number): boolean => {
    const walls = FENCE_EDGES.filter((e) => stoneKeys.has((y + e.dy) * world.width + (x + e.dx)))
    if (walls.length === 0 || h01(x, y, 21) >= chance) return false
    const edge = walls[Math.floor(h01(x, y, 22) * walls.length)]
    const rng = createRng(hashInt(x, y, 23))
    const t = h01(x, y, 20)
    const parts =
      t < 0.34
        ? barrelParts(rng)
        : t < 0.6
          ? crateParts(rng)
          : t < 0.78
            ? sackParts(rng)
            : t < 0.9
              ? lampPostParts()
              : signpostParts()
    // Face away from the wall (into the room/street), with a little jitter.
    const rot = Math.atan2(-edge.dx, -edge.dy) + (h01(x, y, 24) - 0.5) * 0.5
    placeProp(parts, rot, x + 0.5 + edge.dx * 0.3, y + 0.5 + edge.dy * 0.3)
    return true
  }

  // Interior floors: furnish along the walls, but never with foliage — a room
  // gets barrels/crates/sacks/lamps, not bushes and grass tufts.
  for (const { x, y } of floorTiles) {
    if (world.nodeAt(x, y) || world.objectAt(x, y)) continue
    tryPlaceProp(x, y, 0.28)
  }

  for (const { x, y } of grassTiles) {
    // Never decorate interactive tiles (trees, rocks, fishing spots, bank,
    // shop, range) — their meshes and pickability must stay clear.
    if (world.nodeAt(x, y) || world.objectAt(x, y)) continue

    // A building prop against an outdoor wall wins the tile over foliage.
    if (tryPlaceProp(x, y, 0.14)) continue

    // Foliage: lush along edges (next to walls/water/blocked), sparse and low
    // in the open so it never crowds the walkable interior or hides entities.
    let edges = 0
    if (!world.isWalkable(x + 1, y)) edges++
    if (!world.isWalkable(x - 1, y)) edges++
    if (!world.isWalkable(x, y + 1)) edges++
    if (!world.isWalkable(x, y - 1)) edges++
    const onEdge = edges > 0

    if (h01(x, y, 1) <= (onEdge ? 0.34 : 0.1)) {
      const rng = createRng(hashInt(x, y, 7))
      const t = h01(x, y, 2)
      const parts = onEdge
        ? t < 0.3
          ? bushParts(rng)
          : t < 0.52
            ? fernParts(rng)
            : t < 0.74
              ? flowerParts(rng)
              : grassTuftParts(rng)
        : t < 0.66
          ? grassTuftParts(rng)
          : flowerParts(rng)
      const rot = h01(x, y, 3) * Math.PI * 2
      const scale = 0.8 + h01(x, y, 4) * 0.4
      const ox = (h01(x, y, 5) - 0.5) * 0.44
      const oz = (h01(x, y, 6) - 0.5) * 0.44
      placeFoliage(parts, rot, scale, x + 0.5 + ox, y + 0.5 + oz)
    }

    // Riverbank railings: a fence on every edge that meets water, with the
    // odd deterministic gap so a run reads as a rustic fence with gates.
    for (const edge of FENCE_EDGES) {
      if (!waterKeys.has((y + edge.dy) * world.width + (x + edge.dx))) continue
      if (h01(x * 4 + edge.dx, y * 4 + edge.dy, 11) < 0.06) continue
      placeFence(fenceParts(), edge.rot, x + edge.ex, y + edge.ez)
    }
  }

  // Fold each colour bucket into one static mesh (a few draw calls total).
  const flush = (
    map: Map<number, THREE.BufferGeometry[]>,
    material: (color: number) => THREE.Material,
  ): void => {
    for (const [color, geos] of map) {
      const merged = mergeGeometries(geos, false)
      for (const g of geos) g.dispose()
      if (!merged) continue
      res.geo(merged)
      group.add(new THREE.Mesh(merged, material(color)))
    }
  }
  flush(foliageByColor, (color) => swayMaterial(res, color, sway))
  flush(fenceByColor, (color) => res.mat(color))
  flush(propByColor, (color) => res.mat(color))

  return { group, sway }
}
