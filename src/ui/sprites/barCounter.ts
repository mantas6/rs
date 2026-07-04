// Bar counter (the pub's beer shop): a sturdy wooden counter with a hooped
// keg/barrel behind it and a couple of mugs on top, so it reads clearly as a
// tavern bar rather than the awninged general-store stall.
//
// Parented to the tile group from `tileGroup` (which carries userData.tile);
// the renderer's picker walks up from the hit child mesh to that tagged group,
// so every nested primitive still resolves to this object's tile — matching
// the general-store counter (see renderer.ts pickTile).
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'
import { box, cylinder, WOOD, WOOD_DARK, WOOD_LIGHT } from './stall'

/** Golden ale in the mugs, a warm amber that reads against the wood. */
const ALE = 0xd9a441
/** Pewter mug body, a cool grey to separate the mugs from the counter. */
const PEWTER = 0x9aa0a6

export function createBarCounterMesh(res: SpriteResources, x: number, y: number): THREE.Group {
  const group = tileGroup(x, y)

  // Counter carcass + overhanging light top (surface sits at y ≈ 0.64).
  group.add(box(res, [0.86, 0.56, 0.34], WOOD, [0, 0.28, 0.08]))
  group.add(box(res, [0.98, 0.08, 0.46], WOOD_LIGHT, [0, 0.6, 0.06]))
  // A low foot rail across the front on two short posts.
  group.add(box(res, [0.9, 0.05, 0.05], WOOD_DARK, [0, 0.12, -0.16]))

  // A hooped ale keg standing behind the counter (on its end).
  group.add(cylinder(res, 0.2, 0.5, WOOD_DARK, [0.28, 0.25, 0.42]))
  group.add(cylinder(res, 0.21, 0.04, WOOD_LIGHT, [0.28, 0.12, 0.42]))
  group.add(cylinder(res, 0.21, 0.04, WOOD_LIGHT, [0.28, 0.38, 0.42]))

  // A small stacked cask beside the keg.
  group.add(cylinder(res, 0.13, 0.26, WOOD, [-0.3, 0.55, 0.42]))
  group.add(cylinder(res, 0.14, 0.03, WOOD_LIGHT, [-0.3, 0.48, 0.42]))
  group.add(cylinder(res, 0.14, 0.03, WOOD_LIGHT, [-0.3, 0.66, 0.42]))

  // A couple of frothy mugs of ale on the counter top.
  for (const mx of [-0.18, 0.16]) {
    group.add(cylinder(res, 0.07, 0.16, PEWTER, [mx, 0.72, 0.04]))
    group.add(cylinder(res, 0.055, 0.05, ALE, [mx, 0.82, 0.04]))
  }

  return group
}
