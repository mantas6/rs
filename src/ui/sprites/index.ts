// Barrel for the sprite factories: one file per visual object. The renderer
// (renderer.ts) imports from here and only does orchestration — scene setup,
// camera, picking, interpolation — never mesh construction.
export { approachAngle, decay01, progress01, yawToward } from './animation'
export { createAnvilMesh } from './anvil'
export { createBankBoothMesh } from './bankBooth'
export { createChickenMesh } from './chickenMesh'
export { createCookingRangeMesh } from './cookingRange'
export { createCowMesh } from './cowMesh'
export {
  createFarmPatchMesh,
  updateFarmPatchGrowth,
  type FarmPatchView,
} from './farmPatch'
export { createFireMesh, updateFireFlicker } from './fire'
export { createFishingSpotMesh, updateFishingSpotPulse } from './fishingSpot'
export { createFurnaceMesh } from './furnace'
export { createGiantRatMesh } from './giantRatMesh'
export { createGoblinMesh } from './goblinMesh'
export { createGroundItemMesh, updateGroundItemSpin } from './groundItem'
export {
  createGroundTiles,
  updateWaterRipple,
  type GroundTiles,
  type WaterAnimation,
} from './groundTiles'
export { createHealthBar, updateHealthBar, type HealthBarView } from './healthBar'
export {
  createHitsplat,
  disposeHitsplat,
  HITSPLAT_LIFETIME_MS,
  updateHitsplat,
  type HitsplatView,
} from './hitsplat'
export { createHoverOutline } from './hoverOutline'
export {
  createNpcMesh,
  updateNpcAnimation,
  type NpcAnimInput,
  type NpcPose,
  type NpcVariant,
  type NpcView,
} from './npcMesh'
export {
  createPlayerMesh,
  updatePlayerAnimation,
  type PlayerAnimInput,
  type PlayerGear,
  type PlayerPose,
  type PlayerView,
} from './playerMesh'
export {
  updatePlayerEquipment,
  VISIBLE_EQUIPMENT_SLOTS,
  type EquippedItemLookup,
} from './playerEquipment'
export { createRockMesh } from './rock'
export { createScenery, type SceneryView } from './scenery'
export { createShopCounterMesh } from './shopCounter'
export { createTreeMesh } from './tree'
export { SpriteResources, tileGroup, type TilePos } from './resources'
