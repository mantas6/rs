// Ground models for the odds-and-ends items (coins, bones, cowhide, feather)
// plus the generic fallback parcel used for any item id without a bespoke
// model, so newly added content never renders blank.
import * as THREE from 'three'
import type { SpriteResources } from '../resources'
import {
  BONE,
  cylinder,
  FEATHER,
  GOLD,
  GOLD_RIM,
  group,
  HIDE,
  HIDE_PATCH,
  QUILL,
  sphere,
  torus,
  WOOD_DARK,
  type Vec3,
} from './primitives'

const HALF_PI = Math.PI / 2

/** A small pile of gold coins — scattered thin discs. */
export function createCoinsModel(res: SpriteResources): THREE.Group {
  // [x, y, z, tilt] for each coin in the heap.
  const coins: Array<[number, number, number, number]> = [
    [-0.09, 0.02, 0.05, 0.1],
    [0.08, 0.02, 0.07, -0.08],
    [0.06, 0.02, -0.08, 0.05],
    [-0.05, 0.04, -0.04, -0.12],
    [0.0, 0.06, 0.02, 0.06],
    [-0.02, 0.09, -0.01, -0.05],
  ]
  const parts: THREE.Object3D[] = []
  for (const [x, y, z, tilt] of coins) {
    parts.push(cylinder(res, 0.08, 0.022, GOLD, [x, y, z], [tilt, 0, tilt * 0.5], 16))
    parts.push(torus(res, 0.08, 0.008, GOLD_RIM, [x, y, z], [HALF_PI + tilt, 0, tilt * 0.5], Math.PI * 2, 16))
  }
  return group(...parts)
}

/** A single bone lying flat, knobbed at both ends. */
export function createBonesModel(res: SpriteResources): THREE.Group {
  const y = 0.04
  const knobs: Vec3[] = [
    [0.15, y, 0.045],
    [0.15, y, -0.045],
    [-0.15, y, 0.045],
    [-0.15, y, -0.045],
  ]
  return group(
    cylinder(res, 0.028, 0.32, BONE, [0, y, 0], [0, 0, HALF_PI]),
    ...knobs.map((pos) => sphere(res, 0.05, BONE, pos)),
  )
}

/** A splayed cowhide: a flat rounded skin with two dark patches. */
export function createCowhideModel(res: SpriteResources): THREE.Group {
  return group(
    sphere(res, 0.22, HIDE, [0, 0.03, 0], [1, 0.14, 0.85]),
    sphere(res, 0.07, HIDE_PATCH, [-0.06, 0.055, 0.03], [1, 0.12, 1]),
    sphere(res, 0.055, HIDE_PATCH, [0.09, 0.055, -0.05], [1, 0.12, 1]),
  )
}

/** A feather: a flat vane with a quill running through it, leaning up. */
export function createFeatherModel(res: SpriteResources): THREE.Group {
  const feather = group(
    sphere(res, 0.1, FEATHER, [0, 0.02, 0], [0.45, 0.1, 1.5]),
    cylinder(res, 0.008, 0.34, QUILL, [0, 0.02, 0], [HALF_PI, 0, 0]),
  )
  feather.rotation.x = -0.5
  feather.position.y = 0.08
  return feather
}

/** Generic fallback: a tied cloth parcel for any unmapped item. */
export function createParcelModel(res: SpriteResources): THREE.Group {
  const sack = 0xb08d57
  return group(
    sphere(res, 0.15, sack, [0, 0.15, 0], [1, 1.1, 1]),
    cylinder(res, 0.05, 0.07, sack, [0, 0.29, 0]),
    torus(res, 0.055, 0.02, WOOD_DARK, [0, 0.28, 0], [HALF_PI, 0, 0]),
  )
}
