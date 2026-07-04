// Dropped item: a small per-item 3D model (see itemModels/) parked on its
// tile, gently spinning and bobbing so it's noticeable. The outer group is a
// `tileGroup` carrying userData.tile, so the renderer's picker resolves the
// exact tile for pick-up; the spin/bob is applied to an inner pivot so the
// tile group itself never moves.
import * as THREE from 'three'
import type { GroundItem } from '../../engine'
import { tileGroup, type SpriteResources } from './resources'
import { createItemModel } from './itemModels/itemModel'

/** Rest height above the tile, and the vertical bob amplitude. */
const LIFT = 0.16
const BOB = 0.04

export function createGroundItemMesh(res: SpriteResources, item: GroundItem): THREE.Group {
  const group = tileGroup(item.x, item.y)
  const pivot = new THREE.Group()
  pivot.position.y = LIFT
  pivot.add(createItemModel(res, item.itemId))
  group.add(pivot)
  return group
}

/** Spin and bob the item; `now` is a milliseconds timestamp. */
export function updateGroundItemSpin(group: THREE.Object3D, now: number): void {
  const pivot = group.children[0]
  if (!pivot) return
  pivot.rotation.y = now / 800
  // Phase-shift the bob per tile so stacks on different tiles desync.
  const tile = group.userData.tile as { x: number; y: number } | undefined
  const phase = tile ? tile.x * 1.7 + tile.y * 2.3 : 0
  pivot.position.y = LIFT + BOB * Math.sin(now / 420 + phase)
}
