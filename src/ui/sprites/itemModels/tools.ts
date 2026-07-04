// Ground models for the gathering tools: woodcutting axe, mining pickaxe,
// small fishing net and tinderbox. Axe/pickaxe take a metal `tint` so bronze
// and iron share a builder; the net and tinderbox are fixed-colour.
import * as THREE from 'three'
import type { SpriteResources } from '../resources'
import {
  box,
  cylinder,
  group,
  METAL_DARK,
  METAL_GREY,
  QUILL,
  SPARK,
  sphere,
  torus,
  WOOD,
} from './primitives'

const HALF_PI = Math.PI / 2

/** Woodcutting axe lying flat: wooden haft with a bearded metal head. */
export function createAxeModel(res: SpriteResources, tint: number): THREE.Group {
  const y = 0.03
  return group(
    cylinder(res, 0.022, 0.36, WOOD, [-0.02, y, 0], [0, 0, HALF_PI]),
    box(res, [0.08, 0.03, 0.16], tint, [0.16, y, 0.02]),
    box(res, [0.03, 0.03, 0.2], tint, [0.19, y, 0.02]),
  )
}

/** Mining pickaxe lying flat: haft with a curved double-ended head. */
export function createPickaxeModel(res: SpriteResources, tint: number): THREE.Group {
  const y = 0.03
  return group(
    cylinder(res, 0.022, 0.34, WOOD, [-0.02, y, 0], [0, 0, HALF_PI]),
    torus(res, 0.14, 0.022, tint, [0.15, y, 0], [HALF_PI, 0, 0], Math.PI * 0.7),
  )
}

/** Small fishing net: a hooped frame with a translucent mesh and a handle. */
export function createFishingNetModel(res: SpriteResources): THREE.Group {
  const frame = 0xc9b892
  const y = 0.05
  return group(
    cylinder(res, 0.02, 0.16, WOOD, [-0.19, y, 0], [0, 0, HALF_PI]),
    torus(res, 0.14, 0.02, frame, [0.02, y, 0], [HALF_PI, 0, 0], Math.PI * 2, 20),
    cylinder(res, 0.13, 0.008, frame, [0.02, y, 0], undefined, 20, {
      transparent: true,
      opacity: 0.28,
    }),
  )
}

/** Tinderbox: a lidded metal box with a spark above it. */
export function createTinderboxModel(res: SpriteResources): THREE.Group {
  return group(
    box(res, [0.22, 0.1, 0.15], METAL_GREY, [0, 0.06, 0]),
    box(res, [0.24, 0.035, 0.16], METAL_DARK, [0, 0.125, 0]),
    sphere(res, 0.02, SPARK, [0.05, 0.2, 0]),
    sphere(res, 0.013, QUILL, [-0.03, 0.17, 0.02]),
  )
}
