// Anvil: a low-poly blacksmith's anvil sitting on a chunky wooden stump — a
// dark iron base, a pinched waist, a broad flat working face, and a tapered
// horn jutting off the front so the silhouette reads as an anvil from any
// angle. Clicking it triggers forging (see GameCanvas / renderer.ts pickTile).
//
// Parented to the tile group from `tileGroup` (which carries userData.tile);
// the renderer's picker walks up from whatever child mesh the ray hits to that
// tagged group, so every nested primitive resolves to this object's tile. All
// geometry and materials come from the shared SpriteResources, so dispose()
// frees them.
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'
import { box, WOOD, WOOD_DARK } from './stall'

// ---- Iron palette (bright enough to sit in the daylight tone map) ----

/** Main anvil iron. */
const IRON = 0x4a4e57
/** Darker iron for the base and shadowed courses. */
const IRON_DARK = 0x30333a
/** Sun-caught, hammer-polished working face. */
const IRON_LIGHT = 0x6c7079

export function createAnvilMesh(res: SpriteResources, x: number, y: number): THREE.Group {
  const group = tileGroup(x, y)

  // Wooden stump the anvil rests on: a squat block on a slightly wider base.
  group.add(box(res, [0.7, 0.1, 0.7], WOOD_DARK, [0, 0.05, 0]))
  group.add(box(res, [0.6, 0.36, 0.6], WOOD, [0, 0.28, 0]))

  // Iron body: a broad foot, a pinched waist, and the heavy top block.
  group.add(box(res, [0.66, 0.12, 0.5], IRON_DARK, [0, 0.52, 0]))
  group.add(box(res, [0.34, 0.16, 0.34], IRON, [0, 0.66, 0]))
  group.add(box(res, [0.78, 0.18, 0.44], IRON, [0, 0.83, 0]))
  // Polished flat working face capping the top.
  group.add(box(res, [0.8, 0.05, 0.46], IRON_LIGHT, [0, 0.94, 0]))

  // Tapered horn jutting off the front (-Z) end of the top block.
  const horn = res.mesh(res.geo(new THREE.ConeGeometry(0.16, 0.34, 12)), IRON, 0.86)
  horn.rotation.x = -Math.PI / 2
  horn.position.set(0, 0.86, -0.55)
  group.add(horn)

  return group
}
