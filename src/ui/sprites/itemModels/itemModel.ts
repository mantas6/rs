// itemId -> ground-model builder for every item in src/content/items.ts.
// Each builder returns a small THREE.Object3D assembled from primitives; the
// renderer parks it on a tile (see groundItem.ts). Unmapped ids fall back to a
// generic parcel so newly added content is never invisible on the ground.
import * as THREE from 'three'
import type { SpriteResources } from '../resources'
import { BRONZE, BURNT, COPPER, IRON, IRON_ORE, OAK, STEEL, STEEL_ORE, TIN, WOOD } from './primitives'
import {
  createDrumstickModel,
  createFishModel,
  createMeatModel,
  createShrimpModel,
} from './food'
import {
  createBonesModel,
  createCoinsModel,
  createCowhideModel,
  createFeatherModel,
  createParcelModel,
} from './misc'
import { createBarModel, createLogsModel, createOreModel } from './resources'
import { createFishingNetModel, createAxeModel, createPickaxeModel, createTinderboxModel } from './tools'
import {
  createHelmModel,
  createPlatebodyModel,
  createPlatelegsModel,
  createScimitarModel,
  createShieldModel,
  createSwordModel,
} from './weapons'

// Cooked/raw/burnt food tints (kept in sync with the SVG icons in ui/icons).
const SHRIMP_RAW = 0xe8a0a8
const SHRIMP_COOKED = 0xef8f5a
const TROUT_RAW = 0xa8bfcc
const TROUT_COOKED = 0xc98a4b
const BEEF_RAW = 0xd96a6a
const BEEF_COOKED = 0xa15c2f
const CHICKEN_RAW = 0xe8b8b0
const CHICKEN_COOKED = 0xd29a56

type Builder = (res: SpriteResources) => THREE.Object3D

const BUILDERS: Record<string, Builder> = {
  coins: (r) => createCoinsModel(r),

  // Tools.
  bronze_axe: (r) => createAxeModel(r, BRONZE),
  iron_axe: (r) => createAxeModel(r, IRON),
  steel_axe: (r) => createAxeModel(r, STEEL),
  bronze_pickaxe: (r) => createPickaxeModel(r, BRONZE),
  iron_pickaxe: (r) => createPickaxeModel(r, IRON),
  steel_pickaxe: (r) => createPickaxeModel(r, STEEL),
  small_fishing_net: (r) => createFishingNetModel(r),
  tinderbox: (r) => createTinderboxModel(r),

  // Weapons & armour.
  bronze_sword: (r) => createSwordModel(r, BRONZE),
  bronze_scimitar: (r) => createScimitarModel(r, BRONZE),
  wooden_shield: (r) => createShieldModel(r, WOOD),
  bronze_full_helm: (r) => createHelmModel(r, BRONZE),
  bronze_platebody: (r) => createPlatebodyModel(r, BRONZE),
  bronze_platelegs: (r) => createPlatelegsModel(r, BRONZE),

  // Gathered resources.
  logs: (r) => createLogsModel(r, WOOD),
  oak_logs: (r) => createLogsModel(r, OAK),
  copper_ore: (r) => createOreModel(r, COPPER),
  tin_ore: (r) => createOreModel(r, TIN),
  iron_ore: (r) => createOreModel(r, IRON_ORE),
  steel_ore: (r) => createOreModel(r, STEEL_ORE),
  bronze_bar: (r) => createBarModel(r, BRONZE),
  iron_bar: (r) => createBarModel(r, IRON),
  steel_bar: (r) => createBarModel(r, STEEL),

  // Food (raw / cooked / burnt).
  raw_shrimps: (r) => createShrimpModel(r, SHRIMP_RAW),
  shrimps: (r) => createShrimpModel(r, SHRIMP_COOKED),
  burnt_shrimps: (r) => createShrimpModel(r, BURNT),
  raw_trout: (r) => createFishModel(r, TROUT_RAW),
  trout: (r) => createFishModel(r, TROUT_COOKED),
  burnt_trout: (r) => createFishModel(r, BURNT),
  raw_beef: (r) => createMeatModel(r, BEEF_RAW),
  cooked_beef: (r) => createMeatModel(r, BEEF_COOKED),
  burnt_beef: (r) => createMeatModel(r, BURNT),
  raw_chicken: (r) => createDrumstickModel(r, CHICKEN_RAW),
  cooked_chicken: (r) => createDrumstickModel(r, CHICKEN_COOKED),
  burnt_chicken: (r) => createDrumstickModel(r, BURNT),

  // Misc.
  bones: (r) => createBonesModel(r),
  cowhide: (r) => createCowhideModel(r),
  feather: (r) => createFeatherModel(r),
}

/**
 * Build the ground model for an item id. Falls back to a tied parcel for any
 * id without a bespoke builder so unmapped items still render something.
 */
export function createItemModel(res: SpriteResources, itemId: string): THREE.Object3D {
  const build = BUILDERS[itemId]
  return build ? build(res) : createParcelModel(res)
}
