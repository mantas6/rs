// Cooking range: a low-poly stone oven parked on its tile — a mortared stone
// body on a wider plinth, a lighter stone cooktop, a sooty arched fire chamber
// glowing at the front, a bed of embers with a couple of flames on top, and a
// short chimney at the back for silhouette.
//
// Parented to the tile group from `tileGroup` (which carries userData.tile);
// the renderer's picker walks up from whatever child mesh the ray hits to that
// tagged group, so every nested primitive resolves to this object's tile and
// clicking it still triggers cooking (see renderer.ts pickTile). All geometry
// and materials come from the shared SpriteResources, so dispose() frees them.
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'
import { box } from './stall'

// ---- Stone + fire palette (bright enough to sit in the daylight tone map) ----

/** Structural stone body. */
const STONE = 0x74767a
/** Darker stone for the plinth and chimney (mortar / shadowed blocks). */
const STONE_DARK = 0x4c4e52
/** Sun-caught stone cooktop and chimney cap. */
const STONE_LIGHT = 0x9a9ca1
/** Sooty interior of the fire chamber. */
const SOOT = 0x1c1512
/** Dark, cooling coals. */
const COAL = 0x8f2d10
/** Hot outer flame (matches the firemaking fire). */
const FLAME_OUTER = 0xe25822
/** Bright inner flame/glow core. */
const FLAME_INNER = 0xffb347

export function createCookingRangeMesh(res: SpriteResources, x: number, y: number): THREE.Group {
  const group = tileGroup(x, y)

  // Stone carcass: a wider base plinth, the main body, and a lighter cooktop
  // slab overhanging the top (cooking surface sits at y ≈ 0.92).
  group.add(box(res, [0.94, 0.14, 0.94], STONE_DARK, [0, 0.07, 0]))
  group.add(box(res, [0.86, 0.66, 0.86], STONE, [0, 0.47, 0]))
  group.add(box(res, [0.96, 0.12, 0.96], STONE_LIGHT, [0, 0.86, 0]))

  // Arched fire chamber recessed into the front (-Z) face: a sooty pocket with
  // a bright ember glow so the range reads as lit and hot.
  group.add(box(res, [0.54, 0.42, 0.16], SOOT, [0, 0.35, -0.4]))
  group.add(box(res, [0.44, 0.3, 0.06], FLAME_OUTER, [0, 0.31, -0.45]))
  group.add(box(res, [0.28, 0.16, 0.04], FLAME_INNER, [0, 0.28, -0.47]))

  // A bed of glowing coals sitting on the cooktop.
  group.add(box(res, [0.58, 0.06, 0.58], COAL, [0, 0.95, 0]))
  group.add(box(res, [0.44, 0.05, 0.44], FLAME_OUTER, [0, 0.985, 0]))

  // A couple of flames licking up off the coals (cones like the campfire).
  const flame = res.mesh(res.geo(new THREE.ConeGeometry(0.2, 0.5, 8)), FLAME_OUTER, 1.24)
  flame.position.set(0.06, 1.24, 0)
  group.add(flame)
  const flameCore = res.mesh(res.geo(new THREE.ConeGeometry(0.11, 0.34, 8)), FLAME_INNER, 1.3)
  flameCore.position.set(0.06, 1.3, 0)
  group.add(flameCore)
  const flameSmall = res.mesh(res.geo(new THREE.ConeGeometry(0.12, 0.32, 8)), FLAME_OUTER, 1.14)
  flameSmall.position.set(-0.16, 1.14, 0.12)
  group.add(flameSmall)

  // Short stone chimney at the back with a lighter cap.
  group.add(box(res, [0.22, 0.5, 0.22], STONE_DARK, [0.26, 1.17, 0.3]))
  group.add(box(res, [0.28, 0.08, 0.28], STONE_LIGHT, [0.26, 1.46, 0.3]))

  return group
}
