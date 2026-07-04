// Ground models for the equipment items: the two melee weapons (sword,
// scimitar) and the four armour pieces (shield, full helm, platebody,
// platelegs). Each is a small arrangement of primitives lying just above the
// tile; the metal `tint` lets bronze/iron variants share one builder.
import * as THREE from 'three'
import type { SpriteResources } from '../resources'
import {
  box,
  cone,
  cylinder,
  group,
  sphere,
  STEEL,
  torus,
  WOOD_DARK,
  WOOD_HAFT,
  type Vec3,
} from './primitives'

const HALF_PI = Math.PI / 2

/** Straight sword lying flat: tapered blade, crossguard, grip and pommel. */
export function createSwordModel(res: SpriteResources, tint: number): THREE.Group {
  const y = 0.03
  return group(
    // Grip + pommel at the -X end.
    sphere(res, 0.035, WOOD_HAFT, [-0.27, y, 0]),
    cylinder(res, 0.025, 0.1, WOOD_DARK, [-0.19, y, 0], [0, 0, HALF_PI]),
    box(res, [0.03, 0.02, 0.16], WOOD_HAFT, [-0.13, y, 0]),
    // Blade running to +X, ending in a point.
    box(res, [0.3, 0.02, 0.06], tint, [0.03, y, 0]),
    cone(res, 0.03, 0.09, tint, [0.23, y, 0], [0, 0, -HALF_PI]),
  )
}

/** Curved scimitar: a torus-arc crescent blade with a short dark grip. */
export function createScimitarModel(res: SpriteResources, tint: number): THREE.Group {
  const y = 0.04
  const blade = torus(res, 0.18, 0.022, tint, [0.02, y, 0], [HALF_PI, 0, 0], Math.PI * 0.72)
  return group(
    blade,
    box(res, [0.04, 0.03, 0.14], WOOD_HAFT, [0.18, y, 0.02]),
    cylinder(res, 0.024, 0.11, WOOD_DARK, [0.2, y, 0.13], [HALF_PI, 0, 0]),
  )
}

/** Round wooden shield: a flat disc with a metal rim and central boss. */
export function createShieldModel(res: SpriteResources, woodTint: number): THREE.Group {
  const y = 0.05
  const shield = group(
    cylinder(res, 0.2, 0.04, woodTint, [0, y, 0], undefined, 20),
    torus(res, 0.2, 0.022, STEEL, [0, y, 0], [HALF_PI, 0, 0], Math.PI * 2, 24),
    sphere(res, 0.06, STEEL, [0, y + 0.02, 0]),
  )
  // Tilt slightly so the face catches the light rather than lying dead flat.
  shield.rotation.x = -0.35
  return shield
}

/** Full helm: a metal dome with a dark eye slit and a lower rim. */
export function createHelmModel(res: SpriteResources, tint: number): THREE.Group {
  const dome = sphere(res, 0.16, tint, [0, 0.14, 0], [1, 0.95, 1])
  return group(
    dome,
    cylinder(res, 0.16, 0.05, tint, [0, 0.06, 0], undefined, 16),
    box(res, [0.1, 0.03, 0.06], 0x1a1712, [0, 0.14, 0.15]),
  )
}

/** Platebody: an armoured torso with rounded shoulders and a neck hole. */
export function createPlatebodyModel(res: SpriteResources, tint: number): THREE.Group {
  return group(
    box(res, [0.26, 0.26, 0.15], tint, [0, 0.15, 0]),
    sphere(res, 0.08, tint, [-0.15, 0.26, 0]),
    sphere(res, 0.08, tint, [0.15, 0.26, 0]),
    cylinder(res, 0.07, 0.04, 0x1a1712, [0, 0.28, 0]),
  )
}

/** Platelegs: two armoured legs joined by a dark belt. */
export function createPlatelegsModel(res: SpriteResources, tint: number): THREE.Group {
  const leg: Vec3 = [0.1, 0.24, 0.12]
  return group(
    box(res, leg, tint, [-0.07, 0.12, 0]),
    box(res, leg, tint, [0.07, 0.12, 0]),
    box(res, [0.26, 0.06, 0.14], WOOD_DARK, [0, 0.22, 0]),
  )
}
