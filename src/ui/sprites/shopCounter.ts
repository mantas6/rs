// Shop counter (general store): a market stall clearly distinct from the bank
// — a wooden counter shaded by a striped red/cream awning on two posts, with
// goods (a crate and a hooped barrel) on top and a small "SHOP" board hung
// from the canopy.
//
// Parented to the tile group from `tileGroup` (which carries userData.tile);
// the renderer's picker walks up from the hit child mesh to that tagged group,
// so every nested primitive still resolves to this object's tile — matching
// the old single cube (see renderer.ts pickTile).
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'
import {
  box,
  cylinder,
  paintAwningStripes,
  paintShopSign,
  signPlane,
  texturedMaterial,
  WOOD,
  WOOD_DARK,
  WOOD_LIGHT,
} from './stall'

/** Warm crate wood, a touch redder than the counter so goods read separately. */
const CRATE = 0xa5773f

export function createShopCounterMesh(res: SpriteResources, x: number, y: number): THREE.Group {
  const group = tileGroup(x, y)

  // Counter carcass + overhanging light top (surface sits at y ≈ 0.64).
  group.add(box(res, [0.86, 0.56, 0.34], WOOD, [0, 0.28, 0.08]))
  group.add(box(res, [0.98, 0.08, 0.46], WOOD_LIGHT, [0, 0.6, 0.06]))

  // Two posts holding up the canopy.
  group.add(box(res, [0.08, 1.2, 0.08], WOOD_DARK, [-0.42, 0.6, 0.4]))
  group.add(box(res, [0.08, 1.2, 0.08], WOOD_DARK, [0.42, 0.6, 0.4]))

  // Striped awning: a thin slab tilted forward over the counter.
  const awning = new THREE.Mesh(
    res.geo(new THREE.BoxGeometry(1.14, 0.06, 0.66)),
    texturedMaterial(res, 'shopAwning', [256, 128], paintAwningStripes),
  )
  awning.position.set(0, 1.18, 0.02)
  awning.rotation.x = -0.32 // Front edge dips toward the player.
  group.add(awning)

  // Goods on the counter: a stacked crate and a hooped barrel.
  group.add(box(res, [0.24, 0.24, 0.24], CRATE, [-0.26, 0.76, 0.02]))
  group.add(box(res, [0.18, 0.18, 0.18], WOOD, [-0.26, 1.0, 0.02]))
  group.add(cylinder(res, 0.13, 0.3, WOOD_DARK, [0.28, 0.79, 0.0]))
  group.add(cylinder(res, 0.14, 0.03, WOOD_LIGHT, [0.28, 0.72, 0.0]))
  group.add(cylinder(res, 0.14, 0.03, WOOD_LIGHT, [0.28, 0.86, 0.0]))

  // "SHOP" board slung under the front of the awning on two short hangers.
  group.add(box(res, [0.02, 0.14, 0.02], WOOD_DARK, [-0.22, 1.02, -0.28]))
  group.add(box(res, [0.02, 0.14, 0.02], WOOD_DARK, [0.22, 1.02, -0.28]))
  group.add(box(res, [0.56, 0.2, 0.05], WOOD_LIGHT, [0, 0.9, -0.27]))
  group.add(signPlane(res, 'shopSign', [0.5, 0.15], [256, 80], [0, 0.9, -0.3], paintShopSign))

  return group
}
