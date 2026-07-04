// Ground models for the food items. Each shape is shared across its
// raw/cooked/burnt states — only the `tint` differs — so a raw and a burnt
// trout are the same fish in a different colour, matching the item icons.
import * as THREE from 'three'
import type { SpriteResources } from '../resources'
import { BONE, cone, cylinder, group, sphere, torus } from './primitives'

const HALF_PI = Math.PI / 2
/** Dark eye dot shared by the shrimp and fish. */
const EYE = 0x14100a

/** A curled shrimp: a fat torso arc, a flared tail and two antennae. */
export function createShrimpModel(res: SpriteResources, tint: number): THREE.Group {
  const y = 0.07
  return group(
    torus(res, 0.09, 0.035, tint, [0, y, 0], [HALF_PI, 0, 0], Math.PI * 1.4),
    cone(res, 0.045, 0.09, tint, [-0.09, y, 0.02], [0, 0, HALF_PI]),
    cylinder(res, 0.006, 0.1, tint, [0.11, y, -0.06], [0, 0.5, HALF_PI]),
    cylinder(res, 0.006, 0.09, tint, [0.11, y, -0.02], [0, -0.3, HALF_PI]),
    sphere(res, 0.015, EYE, [0.09, y + 0.02, -0.05]),
  )
}

/** A whole fish: an elongated body, a fanned tail and an eye. */
export function createFishModel(res: SpriteResources, tint: number): THREE.Group {
  const y = 0.1
  return group(
    sphere(res, 0.1, tint, [0.02, y, 0], [1.9, 0.85, 0.8]),
    cone(res, 0.09, 0.13, tint, [-0.2, y, 0], [0, 0, HALF_PI]),
    sphere(res, 0.018, EYE, [0.14, y + 0.03, 0.05]),
  )
}

/** A cut of meat: a rounded fillet with a small bone nub. */
export function createMeatModel(res: SpriteResources, tint: number): THREE.Group {
  const y = 0.09
  return group(
    sphere(res, 0.14, tint, [0, y, 0], [1.15, 0.7, 1]),
    sphere(res, 0.03, BONE, [0.15, y, 0.02], [1, 0.8, 1]),
  )
}

/** A chicken drumstick: an ellipsoid of meat on a knobbed bone. */
export function createDrumstickModel(res: SpriteResources, tint: number): THREE.Group {
  const y = 0.1
  return group(
    sphere(res, 0.12, tint, [-0.03, y, 0], [1, 0.95, 0.95]),
    cylinder(res, 0.02, 0.17, BONE, [0.13, y - 0.03, 0], [0, 0, -0.9]),
    sphere(res, 0.032, BONE, [0.2, y - 0.09, 0]),
  )
}
