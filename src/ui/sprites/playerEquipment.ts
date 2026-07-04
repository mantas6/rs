// Worn-equipment visuals for the player avatar. Reads the engine's current
// Equipment (via a slot -> itemId getter, so this file stays decoupled from
// engine classes) and fills the PlayerView's gear anchors with meshes:
//
//   - weapon / shield: the existing ground item models (itemModels/) re-posed
//     into the hands, so every current + future weapon/tool/shield is covered
//     for free and swings with the arm animation.
//   - head / body / legs / cape: simple tinted overlays sized to the body
//     parts, in the low-poly style of the rest of the avatar. The metal tier
//     is inferred from the item id (bronze/iron/steel/...), matching how the
//     ground models pick their tint.
//
// UI-only (src/ui/): this only touches Three.js and reuses the shared
// SpriteResources cache, so rebuilding the layer on every equipment change
// reuses cached geometries/materials and never leaks GPU memory. Removing old
// gear just detaches the (shared) meshes; disposal happens once, centrally,
// when SpriteResources.dispose() runs at renderer teardown.
import * as THREE from 'three'
import type { EquipmentSlot } from '../../content/types'
import { createItemModel } from './itemModels/itemModel'
import { BRONZE, box, IRON, sphere, STEEL, WOOD } from './itemModels/primitives'
import type { PlayerView } from './playerMesh'
import type { SpriteResources } from './resources'

const HALF_PI = Math.PI / 2

// Metal tiers with no ground-model palette entry yet; kept here so higher-tier
// armour still tints sensibly if it's added to content later.
const MITHRIL = 0x4a6fd0
const ADAMANT = 0x4f7f5f
const RUNE = 0x5fa9b0
/** Dark visor slit / neck hole on metal armour. */
const VISOR = 0x1a1712

/** Slots drawn on the avatar; the rest (neck/ammo/hands/feet/ring) are stat-only. */
export const VISIBLE_EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'weapon',
  'shield',
  'head',
  'body',
  'legs',
  'cape',
]

/** Returns the equipped item id in a slot, or null when the slot is empty. */
export type EquippedItemLookup = (slot: EquipmentSlot) => string | null

/** Infer an armour/metal tint from the item id's tier prefix. */
function metalTint(itemId: string): number {
  if (itemId.startsWith('bronze')) return BRONZE
  if (itemId.startsWith('iron')) return IRON
  if (itemId.startsWith('steel')) return STEEL
  if (itemId.startsWith('mithril')) return MITHRIL
  if (itemId.startsWith('adamant')) return ADAMANT
  if (itemId.startsWith('rune')) return RUNE
  if (itemId.startsWith('wood')) return WOOD
  return STEEL
}

/** Detach whatever is in `anchor` and (optionally) hang a new mesh on it. */
function setChild(anchor: THREE.Group, child: THREE.Object3D | null): void {
  // Detach only — geometries/materials are shared + tracked on SpriteResources
  // and are freed once by its dispose(); disposing here would break other users.
  for (const existing of [...anchor.children]) anchor.remove(existing)
  if (child) anchor.add(child)
}

/**
 * Hold a ground item model in the fist. The ground builders lay items flat
 * with their long axis on +X; stand them upright so the blade/head points up
 * out of the hand, tilted slightly forward, and it swings with the arm.
 */
function heldItem(res: SpriteResources, itemId: string | null): THREE.Object3D | null {
  if (!itemId) return null
  const held = new THREE.Group()
  held.add(createItemModel(res, itemId))
  held.rotation.set(-0.2, 0, HALF_PI)
  return held
}

/** Turn a flat ground shield to face forward off the off-hand forearm. */
function heldShield(res: SpriteResources, itemId: string | null): THREE.Object3D | null {
  if (!itemId) return null
  const held = new THREE.Group()
  held.add(createItemModel(res, itemId))
  // Ground shield's face normal points +Y; rotate it to face forward (+Z).
  held.rotation.set(HALF_PI, 0, 0)
  return held
}

/**
 * A full helm encasing the head sphere (r≈0.14): a metal skull a touch larger
 * than the head plus a dark visor slit at the front (+Z is the facing side).
 */
function helm(res: SpriteResources, itemId: string | null): THREE.Object3D | null {
  if (!itemId) return null
  const tint = metalTint(itemId)
  const g = new THREE.Group()
  g.add(sphere(res, 0.155, tint, [0, 0.02, 0], [1, 0.98, 1]))
  g.add(box(res, [0.13, 0.03, 0.06], VISOR, [0, 0.0, 0.13]))
  return g
}

/**
 * Body armour over the torso (0.32×0.44×0.2, centred at y≈0.66 in body space):
 * a slightly larger plate box with rounded pauldrons and a dark neck hole.
 */
function bodyArmour(res: SpriteResources, itemId: string | null): THREE.Object3D | null {
  if (!itemId) return null
  const tint = metalTint(itemId)
  const g = new THREE.Group()
  g.add(box(res, [0.36, 0.46, 0.24], tint, [0, 0.66, 0.005]))
  g.add(sphere(res, 0.09, tint, [-0.17, 0.86, 0]))
  g.add(sphere(res, 0.09, tint, [0.17, 0.86, 0]))
  g.add(box(res, [0.16, 0.04, 0.16], VISOR, [0, 0.9, 0]))
  return g
}

/**
 * A leg guard wrapping one leg. Each leg box (0.13×0.42) is centred at y=-0.21
 * in its pivot's local space; the guard is a touch larger and a little shorter
 * so it doesn't poke through the hip or foot. Built per leg so it strides.
 */
function legGuard(res: SpriteResources, itemId: string): THREE.Object3D {
  return box(res, [0.16, 0.4, 0.16], metalTint(itemId), [0, -0.2, 0])
}

/** A cloth cape hanging down the back (torso back sits near z≈-0.1). */
function cape(res: SpriteResources, itemId: string | null): THREE.Object3D | null {
  if (!itemId) return null
  const g = new THREE.Group()
  g.add(box(res, [0.3, 0.5, 0.03], metalTint(itemId), [0, 0.62, -0.13]))
  return g
}

/**
 * (Re)build the player's worn-equipment layer from the current equipment.
 * Cheap and idempotent: called once when the view is created (so restored
 * saves show gear immediately) and again on every `equipmentChanged` event.
 */
export function updatePlayerEquipment(
  res: SpriteResources,
  view: PlayerView,
  equipped: EquippedItemLookup,
): void {
  const { gear } = view
  setChild(gear.weapon, heldItem(res, equipped('weapon')))
  setChild(gear.shield, heldShield(res, equipped('shield')))
  setChild(gear.head, helm(res, equipped('head')))
  setChild(gear.body, bodyArmour(res, equipped('body')))
  setChild(gear.cape, cape(res, equipped('cape')))

  const legs = equipped('legs')
  setChild(gear.legs[0], legs ? legGuard(res, legs) : null)
  setChild(gear.legs[1], legs ? legGuard(res, legs) : null)
}
