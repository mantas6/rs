// Ground models for the raw gathered resources: cut logs, ore chunks and
// smelted bars. Wood tint distinguishes normal vs oak logs; the fleck colour
// distinguishes copper/tin/iron ore. (Imports the shared SpriteResources from
// the parent sprites/resources.ts — a different file from this one.)
import * as THREE from 'three'
import type { SpriteResources } from '../resources'
import { BRONZE, box, chunk, cylinder, END_GRAIN, group, ROCK, taperedCylinder } from './primitives'

const HALF_PI = Math.PI / 2
/** Sun-caught top face of a fresh bar. */
const BAR_SHEEN = 0xcbb079

/** A bundle of three cut logs (running along X) with pale sawn end-grain. */
export function createLogsModel(res: SpriteResources, tint: number): THREE.Group {
  const parts: THREE.Object3D[] = []
  // Two logs side by side (offset in Z), one resting on top.
  const layout: Array<[number, number]> = [
    [-0.07, 0.06],
    [0.07, 0.06],
    [0, 0.17],
  ]
  for (const [z, y] of layout) {
    parts.push(cylinder(res, 0.06, 0.34, tint, [0, y, z], [0, 0, HALF_PI]))
    parts.push(cylinder(res, 0.05, 0.012, END_GRAIN, [0.171, y, z], [0, 0, HALF_PI]))
  }
  return group(...parts)
}

/** A rough host rock studded with mineral flecks of the ore's colour. */
export function createOreModel(res: SpriteResources, fleck: number): THREE.Group {
  const rock = chunk(res, 0.18, ROCK, [0, 0.14, 0], [1, 0.8, 1])
  return group(
    rock,
    chunk(res, 0.05, fleck, [0.11, 0.2, 0.02]),
    chunk(res, 0.045, fleck, [-0.08, 0.13, 0.09]),
    chunk(res, 0.04, fleck, [0.02, 0.11, -0.12]),
  )
}

/** A smelted metal ingot: a trapezoidal block with a bright top face. */
export function createBarModel(res: SpriteResources, tint = BRONZE): THREE.Group {
  return group(
    taperedCylinder(res, 0.12, 0.16, 0.09, tint, [0, 0.045, 0], [0, Math.PI / 4, 0], 4),
    box(res, [0.15, 0.012, 0.15], BAR_SHEEN, [0, 0.092, 0], [0, Math.PI / 4, 0]),
  )
}
