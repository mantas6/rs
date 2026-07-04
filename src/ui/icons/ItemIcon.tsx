import type { ReactElement } from 'react'
import { AxeIcon } from './AxeIcon'
import { BarIcon } from './BarIcon'
import { BonesIcon } from './BonesIcon'
import { CoinsIcon } from './CoinsIcon'
import { DrumstickIcon } from './DrumstickIcon'
import { FeatherIcon } from './FeatherIcon'
import { FishIcon } from './FishIcon'
import { HelmetIcon } from './HelmetIcon'
import { HideIcon } from './HideIcon'
import { LogsIcon } from './LogsIcon'
import { MeatIcon } from './MeatIcon'
import { NetIcon } from './NetIcon'
import { OreIcon } from './OreIcon'
import { PickaxeIcon } from './PickaxeIcon'
import { PlatebodyIcon } from './PlatebodyIcon'
import { PlatelegsIcon } from './PlatelegsIcon'
import { SackIcon } from './SackIcon'
import { ScimitarIcon } from './ScimitarIcon'
import { ShieldIcon } from './ShieldIcon'
import { ShrimpIcon } from './ShrimpIcon'
import { SwordIcon } from './SwordIcon'
import { TinderboxIcon } from './TinderboxIcon'

// Material palette shared across item glyphs.
const BRONZE = '#b08d57'
const IRON = '#9aa0a6'
const STEEL = '#c8ccd2'
const WOOD = '#8b5a2b'
const OAK = '#6e4520'
const BURNT = '#3d3833'

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
}

/**
 * Inline SVG icon for an item id. Unmapped items fall back to a generic
 * sack so newly added content never renders a blank slot.
 */
export function ItemIcon({ itemId }: { itemId: string }): ReactElement {
  const render = ICONS[itemId]
  return render ? render() : <SackIcon />
}
