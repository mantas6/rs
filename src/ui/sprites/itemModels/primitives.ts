// Shared building blocks for the per-item ground models. Every dropped item
// is assembled from a handful of solid-colour primitives (boxes, cylinders,
// cones, spheres, tori) placed within a small THREE.Group. Geometries are
// cached by shape on the shared SpriteResources (geoBy) so identical parts —
// every coin disc, every bone knob — reuse one BufferGeometry no matter how
// many stacks are on the ground, and materials are cached by colour (mat).
//
// UI-only (src/ui/): this only touches Three.js, never the engine.
import * as THREE from 'three'
import type { SpriteResources } from '../resources'

export type Vec3 = [number, number, number]

// ---- Shared item palette (mirrors the SVG item icons in ui/icons) ----

/** Warm bronze metal (bronze tools/weapons/armour, ingots). */
export const BRONZE = 0xb08d57
/** Cool grey iron metal (iron tools). */
export const IRON = 0x9aa0a6
/** Bright blade steel (edges/highlights on metal). */
export const STEEL = 0xc8ccd2
/** Medium plank wood (hafts, logs, shields). */
export const WOOD = 0x8b5a2b
/** Darker oak wood. */
export const OAK = 0x6e4520
/** Dark grip/binding wood. */
export const WOOD_DARK = 0x5b3a1e
/** Lighter haft/pommel wood (also the sword grip wrap). */
export const WOOD_HAFT = 0x8a6b2f
/** Pale sawn end-grain on cut logs. */
export const END_GRAIN = 0xd9b380
/** Charred food and other burnt things. */
export const BURNT = 0x3d3833
/** Coin gold. */
export const GOLD = 0xd4af37
/** Darker gold coin rim. */
export const GOLD_RIM = 0x8a6b1f
/** Off-white bone. */
export const BONE = 0xece5d3
/** Tan cowhide. */
export const HIDE = 0xc9a86a
/** Dark hide patches. */
export const HIDE_PATCH = 0x3f3428
/** Pale feather vane. */
export const FEATHER = 0xe8e4da
/** Feather quill / shaft tan. */
export const QUILL = 0xb8a888
/** Neutral host rock for ore chunks. */
export const ROCK = 0x7d7468
/** Copper mineral flecks. */
export const COPPER = 0xb87333
/** Tin mineral flecks. */
export const TIN = 0xc8c8d0
/** Iron mineral flecks. */
export const IRON_ORE = 0x8a4a3d
/** Dull metal (tinderbox body). */
export const METAL_GREY = 0x8f8f8f
/** Darker metal (tinderbox lid). */
export const METAL_DARK = 0x6f6f6f
/** Warm spark / ember. */
export const SPARK = 0xf4d03f

interface MeshOpts {
  transparent?: boolean
  opacity?: number
}

function apply(mesh: THREE.Mesh, pos: Vec3, rot?: Vec3): THREE.Mesh {
  mesh.position.set(pos[0], pos[1], pos[2])
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2])
  return mesh
}

function make(
  res: SpriteResources,
  key: string,
  geometry: () => THREE.BufferGeometry,
  color: number,
  pos: Vec3,
  rot?: Vec3,
  opts?: MeshOpts,
): THREE.Mesh {
  const mesh = new THREE.Mesh(res.geoBy(key, geometry), res.mat(color, opts))
  return apply(mesh, pos, rot)
}

/** A solid-colour box. */
export function box(
  res: SpriteResources,
  size: Vec3,
  color: number,
  pos: Vec3,
  rot?: Vec3,
  opts?: MeshOpts,
): THREE.Mesh {
  return make(
    res,
    `box:${size[0]}:${size[1]}:${size[2]}`,
    () => new THREE.BoxGeometry(size[0], size[1], size[2]),
    color,
    pos,
    rot,
    opts,
  )
}

/** A solid-colour cylinder (equal end radii); `opts` allows translucency. */
export function cylinder(
  res: SpriteResources,
  radius: number,
  height: number,
  color: number,
  pos: Vec3,
  rot?: Vec3,
  seg = 12,
  opts?: MeshOpts,
): THREE.Mesh {
  return make(
    res,
    `cyl:${radius}:${radius}:${height}:${seg}`,
    () => new THREE.CylinderGeometry(radius, radius, height, seg),
    color,
    pos,
    rot,
    opts,
  )
}

/** A tapered cylinder (differing end radii) — ingots, blade tips, hafts. */
export function taperedCylinder(
  res: SpriteResources,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: number,
  pos: Vec3,
  rot?: Vec3,
  seg = 12,
): THREE.Mesh {
  return make(
    res,
    `cyl:${radiusTop}:${radiusBottom}:${height}:${seg}`,
    () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, seg),
    color,
    pos,
    rot,
  )
}

/** A solid-colour cone. */
export function cone(
  res: SpriteResources,
  radius: number,
  height: number,
  color: number,
  pos: Vec3,
  rot?: Vec3,
  seg = 10,
): THREE.Mesh {
  return make(
    res,
    `cone:${radius}:${height}:${seg}`,
    () => new THREE.ConeGeometry(radius, height, seg),
    color,
    pos,
    rot,
  )
}

/** A sphere, optionally squashed into an ellipsoid via `scale`. */
export function sphere(
  res: SpriteResources,
  radius: number,
  color: number,
  pos: Vec3,
  scale?: Vec3,
  seg = 12,
): THREE.Mesh {
  const mesh = make(res, `sph:${radius}:${seg}`, () => new THREE.SphereGeometry(radius, seg, seg), color, pos)
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2])
  return mesh
}

/** A faceted rock chunk (dodecahedron), optionally squashed via `scale`. */
export function chunk(
  res: SpriteResources,
  radius: number,
  color: number,
  pos: Vec3,
  scale?: Vec3,
  detail = 0,
): THREE.Mesh {
  const mesh = make(
    res,
    `dod:${radius}:${detail}`,
    () => new THREE.DodecahedronGeometry(radius, detail),
    color,
    pos,
  )
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2])
  return mesh
}

/** A torus / torus-arc (rings, hoops, curved blades). */
export function torus(
  res: SpriteResources,
  radius: number,
  tube: number,
  color: number,
  pos: Vec3,
  rot?: Vec3,
  arc = Math.PI * 2,
  seg = 16,
): THREE.Mesh {
  return make(
    res,
    `tor:${radius}:${tube}:${arc}:${seg}`,
    () => new THREE.TorusGeometry(radius, tube, 8, seg, arc),
    color,
    pos,
    rot,
  )
}

/** Convenience: a new group holding the given parts. */
export function group(...parts: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group()
  for (const part of parts) g.add(part)
  return g
}
