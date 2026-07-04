// Farm patch: a tilled soil bed with a crop that visibly grows. A brown soil
// slab always sits on the tile; a "crop" group of little green cones scales up
// as the planted crop matures (empty when unplanted) and shifts to a ripe
// colour once fully grown, so the patch reads at a glance.
//
// Parented to the tile group from `tileGroup` (which carries userData.tile) so
// the renderer's picker resolves any nested mesh back to this tile — clicking
// the patch plants or harvests (see renderer.ts / GameCanvas.tsx).
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'
import { box } from './stall'

/** Tilled dark soil. */
const SOIL = 0x5a3d24
/** Raised soil rim. */
const SOIL_DARK = 0x422c19
/** Growing (unripe) crop foliage. */
const CROP_GROWING = 0x4a8f3c
/** Ripe, ready-to-harvest crop. */
const CROP_RIPE = 0x8fbf3a

/** A patch view: the tagged group plus the scalable crop foliage. */
export interface FarmPatchView {
  group: THREE.Group
  /** Foliage container: scaled by growth, hidden when unplanted. */
  crop: THREE.Group
  growing: THREE.Mesh[]
  ripe: THREE.Mesh[]
}

export function createFarmPatchMesh(res: SpriteResources, x: number, y: number): FarmPatchView {
  const group = tileGroup(x, y)

  // Tilled soil: a low rim slab with a slightly inset darker bed.
  group.add(box(res, [0.9, 0.1, 0.9], SOIL_DARK, [0, 0.05, 0]))
  group.add(box(res, [0.78, 0.06, 0.78], SOIL, [0, 0.12, 0]))

  // Crop foliage: a small cluster of cones, one mesh per colour state. Both
  // colour variants share transforms; visibility flips ripe on/off.
  const crop = new THREE.Group()
  const growing: THREE.Mesh[] = []
  const ripe: THREE.Mesh[] = []
  const offsets: Array<[number, number]> = [
    [0, 0],
    [0.22, 0.18],
    [-0.2, -0.16],
    [0.18, -0.2],
    [-0.18, 0.2],
  ]
  for (const [ox, oz] of offsets) {
    const geo = res.geo(new THREE.ConeGeometry(0.12, 0.5, 6))
    const g = new THREE.Mesh(geo, res.mat(CROP_GROWING))
    g.position.set(ox, 0.4, oz)
    const r = new THREE.Mesh(geo, res.mat(CROP_RIPE))
    r.position.set(ox, 0.4, oz)
    r.visible = false
    crop.add(g, r)
    growing.push(g)
    ripe.push(r)
  }
  crop.visible = false
  group.add(crop)

  return { group, crop, growing, ripe }
}

/**
 * Reflect a patch's crop state on its view. `planted` toggles the foliage on;
 * `progress` (0..1) scales it from a sprout to full size; `grown` swaps the
 * foliage to the ripe colour. Purely visual — called each frame by the
 * renderer from engine state.
 */
export function updateFarmPatchGrowth(
  view: FarmPatchView,
  planted: boolean,
  progress: number,
  grown: boolean,
): void {
  view.crop.visible = planted
  if (!planted) return
  const s = 0.35 + 0.65 * Math.min(Math.max(progress, 0), 1)
  view.crop.scale.set(1, s, 1)
  for (const g of view.growing) g.visible = !grown
  for (const r of view.ripe) r.visible = grown
}
