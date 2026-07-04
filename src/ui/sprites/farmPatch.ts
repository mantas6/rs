// Farm patch: a flat tilled-soil bed with visible furrows. Empty patches read
// as low farmland, while planted patches add a bright grid of sprouts that grows
// taller and turns ripe when ready to harvest.
//
// Parented to the tile group from `tileGroup` (which carries userData.tile) so
// the renderer's picker resolves any nested mesh back to this tile — clicking
// the patch plants or harvests (see renderer.ts / GameCanvas.tsx).
import * as THREE from 'three'
import { tileGroup, type SpriteResources } from './resources'
import { box } from './stall'

/** Tilled dark soil. */
const SOIL = 0x5a3d24
/** Darker damp soil in the furrows. */
const SOIL_DARK = 0x422c19
/** Light, sun-caught crest of a tilled furrow ridge (contrasts the dark bed). */
const SOIL_RIDGE = 0x7a5330
/** Growing (unripe) crop foliage. */
const CROP_GROWING = 0x55b84f
/** Ripe, ready-to-harvest crop. */
const CROP_RIPE = 0xb4d64a

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

  // Tilled soil: a thin ground-level bed, not a raised wall-like block.
  group.add(box(res, [0.9, 0.025, 0.9], SOIL_DARK, [0, 0.025, 0]))
  group.add(box(res, [0.82, 0.025, 0.82], SOIL, [0, 0.045, 0]))

  // Furrow ridges: parallel raised soil rows across the bed, in a lighter tone
  // than the bed so the tilled texture catches the light and reads clearly as
  // ploughed farmland even when nothing is planted.
  for (const oz of [-0.3, -0.1, 0.1, 0.3]) {
    group.add(box(res, [0.7, 0.025, 0.055], SOIL_RIDGE, [0, 0.07, oz]))
  }

  // Crop foliage: a clear planted-state signal. A full grid of sprouts appears
  // as soon as a seed is planted, then scales up as the crop matures.
  const crop = new THREE.Group()
  const growing: THREE.Mesh[] = []
  const ripe: THREE.Mesh[] = []
  const offsets: Array<[number, number]> = []
  for (const ox of [-0.24, 0, 0.24]) {
    for (const oz of [-0.3, -0.1, 0.1, 0.3]) offsets.push([ox, oz])
  }
  const sproutGeo = res.geo(new THREE.ConeGeometry(0.075, 0.34, 6))
  for (const [ox, oz] of offsets) {
    const g = new THREE.Mesh(sproutGeo, res.mat(CROP_GROWING))
    g.position.set(ox, 0.27, oz)
    const r = new THREE.Mesh(sproutGeo, res.mat(CROP_RIPE))
    r.position.set(ox, 0.27, oz)
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
  const s = Math.min(Math.max(progress, 0), 1)
  view.crop.scale.set(0.85 + 0.2 * s, 0.75 + 0.55 * s, 0.85 + 0.2 * s)
  for (const g of view.growing) g.visible = !grown
  for (const r of view.ripe) r.visible = grown
}
