import type { ReactElement } from 'react'
import { ArrowShaftsIcon } from './ArrowShaftsIcon'
import { AxeIcon } from './AxeIcon'
import { BarIcon } from './BarIcon'
import { BeerGlassIcon } from './BeerGlassIcon'
import { BeerIcon } from './BeerIcon'
import { BonesIcon } from './BonesIcon'
import { BootIcon } from './BootIcon'
import { CabbageIcon } from './CabbageIcon'
import { ChapsIcon } from './ChapsIcon'
import { CoinsIcon } from './CoinsIcon'
import { DrumstickIcon } from './DrumstickIcon'
import { FeatherIcon } from './FeatherIcon'
import { FishIcon } from './FishIcon'
import { GlovesIcon } from './GlovesIcon'
import { HelmetIcon } from './HelmetIcon'
import { HerbIcon } from './HerbIcon'
import { HideIcon } from './HideIcon'
import { KnifeIcon } from './KnifeIcon'
import { LeatherIcon } from './LeatherIcon'
import { LogsIcon } from './LogsIcon'
import { MeatIcon } from './MeatIcon'
import { NeedleIcon } from './NeedleIcon'
import { NetIcon } from './NetIcon'
import { NewtEyeIcon } from './NewtEyeIcon'
import { OnionIcon } from './OnionIcon'
import { OreIcon } from './OreIcon'
import { PickaxeIcon } from './PickaxeIcon'
import { PlatebodyIcon } from './PlatebodyIcon'
import { PlatelegsIcon } from './PlatelegsIcon'
import { PotatoIcon } from './PotatoIcon'
import { PotionVialIcon } from './PotionVialIcon'
import { RootIcon } from './RootIcon'
import { SackIcon } from './SackIcon'
import { ScimitarIcon } from './ScimitarIcon'
import { SeedIcon } from './SeedIcon'
import { ShieldIcon } from './ShieldIcon'
import { ShrimpIcon } from './ShrimpIcon'
import { SwordIcon } from './SwordIcon'
import { ThreadIcon } from './ThreadIcon'
import { TinderboxIcon } from './TinderboxIcon'
import { TunicIcon } from './TunicIcon'
import { TwoHandedSwordIcon } from './TwoHandedSwordIcon'
import { UnstrungBowIcon } from './UnstrungBowIcon'
import { VialIcon } from './VialIcon'

// Material palette shared across item glyphs.
const BRONZE = '#b08d57'
const IRON = '#9aa0a6'
const STEEL = '#c8ccd2'
const WOOD = '#8b5a2b'
const OAK = '#6e4520'
const BURNT = '#3d3833'
const LEATHER = '#a9713f'

/** itemId -> icon renderer for every item defined in src/content/items.ts. */
const ICONS: Record<string, () => ReactElement> = {
  coins: () => <CoinsIcon />,
  bronze_axe: () => <AxeIcon color={BRONZE} />,
  iron_axe: () => <AxeIcon color={IRON} />,
  steel_axe: () => <AxeIcon color={STEEL} />,
  bronze_pickaxe: () => <PickaxeIcon color={BRONZE} />,
  iron_pickaxe: () => <PickaxeIcon color={IRON} />,
  steel_pickaxe: () => <PickaxeIcon color={STEEL} />,
  small_fishing_net: () => <NetIcon />,
  tinderbox: () => <TinderboxIcon />,
  bronze_sword: () => <SwordIcon color={BRONZE} />,
  bronze_scimitar: () => <ScimitarIcon color={BRONZE} />,
  bronze_2h_sword: () => <TwoHandedSwordIcon color={BRONZE} />,
  wooden_shield: () => <ShieldIcon color={WOOD} />,
  bronze_full_helm: () => <HelmetIcon color={BRONZE} />,
  bronze_platebody: () => <PlatebodyIcon color={BRONZE} />,
  bronze_platelegs: () => <PlatelegsIcon color={BRONZE} />,
  logs: () => <LogsIcon color={WOOD} />,
  oak_logs: () => <LogsIcon color={OAK} />,
  copper_ore: () => <OreIcon color="#b87333" />,
  tin_ore: () => <OreIcon color="#c8c8d0" />,
  iron_ore: () => <OreIcon color="#8a4a3d" />,
  steel_ore: () => <OreIcon color="#8c96a0" />,
  bronze_bar: () => <BarIcon color={BRONZE} />,
  iron_bar: () => <BarIcon color={IRON} />,
  steel_bar: () => <BarIcon color={STEEL} />,
  raw_shrimps: () => <ShrimpIcon color="#e8a0a8" />,
  shrimps: () => <ShrimpIcon color="#ef8f5a" />,
  burnt_shrimps: () => <ShrimpIcon color={BURNT} />,
  raw_trout: () => <FishIcon color="#a8bfcc" />,
  trout: () => <FishIcon color="#c98a4b" />,
  burnt_trout: () => <FishIcon color={BURNT} />,
  bones: () => <BonesIcon />,
  cowhide: () => <HideIcon />,
  raw_beef: () => <MeatIcon color="#d96a6a" />,
  cooked_beef: () => <MeatIcon color="#a15c2f" />,
  burnt_beef: () => <MeatIcon color={BURNT} />,
  raw_chicken: () => <DrumstickIcon color="#e8b8b0" />,
  cooked_chicken: () => <DrumstickIcon color="#d29a56" />,
  burnt_chicken: () => <DrumstickIcon color={BURNT} />,
  feather: () => <FeatherIcon />,
  leather: () => <LeatherIcon />,
  needle: () => <NeedleIcon />,
  thread: () => <ThreadIcon />,
  leather_gloves: () => <GlovesIcon color={LEATHER} />,
  leather_boots: () => <BootIcon color={LEATHER} />,
  leather_body: () => <TunicIcon color={LEATHER} />,
  leather_chaps: () => <ChapsIcon color={LEATHER} />,
  knife: () => <KnifeIcon />,
  arrow_shafts: () => <ArrowShaftsIcon />,
  shortbow_u: () => <UnstrungBowIcon color={WOOD} />,
  longbow_u: () => <UnstrungBowIcon color={WOOD} long />,
  oak_shortbow_u: () => <UnstrungBowIcon color={OAK} />,
  potato_seed: () => <SeedIcon color="#b98a4a" />,
  onion_seed: () => <SeedIcon color="#d8c07a" />,
  cabbage_seed: () => <SeedIcon color="#9ab060" />,
  potato: () => <PotatoIcon />,
  onion: () => <OnionIcon />,
  cabbage: () => <CabbageIcon />,
  beer: () => <BeerIcon />,
  beer_glass: () => <BeerGlassIcon />,
  grimy_guam: () => <HerbIcon color="#4a6b3a" />,
  guam_leaf: () => <HerbIcon color="#5bbf6a" />,
  grimy_tarromin: () => <HerbIcon color="#6b6a2a" />,
  tarromin: () => <HerbIcon color="#a7b84a" />,
  vial_of_water: () => <VialIcon liquid="#4aa3d8" />,
  empty_vial: () => <VialIcon />,
  eye_of_newt: () => <NewtEyeIcon />,
  limpwurt_root: () => <RootIcon />,
  guam_potion_unf: () => <PotionVialIcon color="#8fae7a" />,
  tarromin_potion_unf: () => <PotionVialIcon color="#9a9a5a" />,
  attack_potion: () => <PotionVialIcon color="#d24a4a" />,
  strength_potion: () => <PotionVialIcon color="#e08a2a" />,
}

/** True when the item id has a dedicated (non-generic) icon glyph. */
export function hasItemIcon(itemId: string): boolean {
  return itemId in ICONS
}

/**
 * Inline SVG icon for an item id. Unmapped items fall back to a generic
 * sack so newly added content never renders a blank slot.
 */
export function ItemIcon({ itemId }: { itemId: string }): ReactElement {
  const render = ICONS[itemId]
  return render ? render() : <SackIcon />
}
