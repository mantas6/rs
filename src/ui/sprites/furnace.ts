// Furnace: a squat low-poly stone forge parked on its tile — a broad brick
// body on a wider plinth, a big sooty arched mouth glowing with molten heat at
// the front, a stone lintel over the mouth, and a fat chimney stack venting a
// bright ember at the back for silhouette.
//
// Parented to the tile group from `tileGroup` (which carries userData.tile);
// the renderer's picker walks up from whatever child mesh the ray hits to that
// tagged group, so every nested primitive resolves to this object's tile and
// clicking it still triggers smelting (see renderer.ts pickTile). All geometry
// and materials come from the shared SpriteResources, so dispose() frees them.
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'
import { box } from './stall'

// ---- Brick + molten palette (bright enough to sit in the daylight tone map) ----

/** Structural fire-brick body. */
const BRICK = 0x8a5b46
/** Darker brick for the plinth and shadowed courses. */
const BRICK_DARK = 0x5e3b2c
/** Sun-caught stone lintel and chimney cap. */
const STONE_LIGHT = 0x9a9ca1
/** Sooty interior of the furnace mouth. */
const SOOT = 0x1c1512
/** Cooling coals rimming the mouth. */
const COAL = 0x8f2d10
/** Hot outer glow (matches the firemaking fire). */
const GLOW_OUTER = 0xe25822
/** Bright molten core. */
const GLOW_INNER = 0xffb347

export function createFurnaceMesh(res: SpriteResources, x: number, y: number): THREE.Group {
  const group = tileGroup(x, y)

  // Brick carcass: a wide base plinth and a tall main block.
  group.add(box(res, [0.98, 0.16, 0.98], BRICK_DARK, [0, 0.08, 0]))
  group.add(box(res, [0.9, 1.0, 0.9], BRICK, [0, 0.66, 0]))
  // A couple of darker mortar courses banding the body.
  group.add(box(res, [0.92, 0.06, 0.92], BRICK_DARK, [0, 0.5, 0]))
  group.add(box(res, [0.92, 0.06, 0.92], BRICK_DARK, [0, 0.9, 0]))

  // Big arched mouth recessed into the front (-Z) face: a sooty pocket with a
  // bright molten glow so the furnace reads as lit and roaring hot.
  group.add(box(res, [0.62, 0.5, 0.18], SOOT, [0, 0.42, -0.42]))
  group.add(box(res, [0.52, 0.4, 0.08], COAL, [0, 0.4, -0.47]))
  group.add(box(res, [0.44, 0.32, 0.06], GLOW_OUTER, [0, 0.4, -0.49]))
  group.add(box(res, [0.28, 0.2, 0.04], GLOW_INNER, [0, 0.38, -0.51]))
  // Stone lintel capping the mouth.
  group.add(box(res, [0.72, 0.1, 0.22], STONE_LIGHT, [0, 0.72, -0.4]))

  // Fat brick chimney at the back with a lighter cap and a licking ember.
  group.add(box(res, [0.34, 0.7, 0.34], BRICK_DARK, [0.22, 1.5, 0.28]))
  group.add(box(res, [0.4, 0.1, 0.4], STONE_LIGHT, [0.22, 1.9, 0.28]))
  const ember = res.mesh(res.geo(new THREE.ConeGeometry(0.14, 0.36, 8)), GLOW_OUTER, 2.02)
  ember.position.set(0.22, 2.02, 0.28)
  group.add(ember)

  return group
}
