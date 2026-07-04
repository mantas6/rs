// Bank booth: an OSRS-style wooden bank stall built from primitives — a solid
// counter with an overhanging top, a framed back wall carrying a blue "BANK"
// banner, and a little coin stack + strongbox on the counter for flavour.
//
// Everything is parented to the tile group from `tileGroup`, which carries
// userData.tile; the renderer's picker walks up from whatever child mesh the
// ray hits to that tagged group, so nested meshes resolve to the right tile
// exactly like the old single cube did (see renderer.ts pickTile).
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'
import { box, cylinder, GOLD, paintBankSign, signPlane, WOOD, WOOD_DARK, WOOD_LIGHT } from './stall'

/** Blue field of the bank banner behind the painted sign. */
const BANNER_BLUE = 0x1e4b8f

export function createBankBoothMesh(res: SpriteResources, x: number, y: number): THREE.Group {
  const group = tileGroup(x, y)

  // Counter carcass (solid base panel) with an overhanging light top.
  group.add(box(res, [0.86, 0.6, 0.34], WOOD, [0, 0.3, 0.08]))
  group.add(box(res, [0.96, 0.08, 0.44], WOOD_LIGHT, [0, 0.64, 0.06]))

  // Back wall: two tall corner posts framing a plank panel.
  group.add(box(res, [0.09, 1.5, 0.09], WOOD_DARK, [-0.42, 0.75, 0.42]))
  group.add(box(res, [0.09, 1.5, 0.09], WOOD_DARK, [0.42, 0.75, 0.42]))
  group.add(box(res, [0.86, 1.0, 0.06], WOOD, [0, 0.5, 0.45]))

  // Banner above the counter: blue backing box + painted "BANK" sign plane.
  group.add(box(res, [0.98, 0.34, 0.1], BANNER_BLUE, [0, 1.5, 0.42]))
  group.add(signPlane(res, 'bankSign', [0.9, 0.28], [256, 80], [0, 1.5, 0.36], paintBankSign))

  // Coin stack on the counter (top surface sits at y ≈ 0.68).
  group.add(cylinder(res, 0.07, 0.025, GOLD, [-0.24, 0.695, 0.02]))
  group.add(cylinder(res, 0.07, 0.025, GOLD, [-0.24, 0.72, 0.02]))
  group.add(cylinder(res, 0.07, 0.025, GOLD, [-0.24, 0.745, 0.02]))

  // A little strongbox: body, lighter lid, gold clasp on the front.
  group.add(box(res, [0.24, 0.14, 0.18], WOOD_DARK, [0.26, 0.75, 0.0]))
  group.add(box(res, [0.24, 0.07, 0.18], WOOD_LIGHT, [0.26, 0.855, 0.0]))
  group.add(box(res, [0.06, 0.06, 0.03], GOLD, [0.26, 0.79, -0.1]))

  return group
}
