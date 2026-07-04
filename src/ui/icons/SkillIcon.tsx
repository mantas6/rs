import type { ReactElement } from 'react'
import type { SkillName } from '../../engine'
import { AnvilIcon } from './AnvilIcon'
import { ArrowIcon } from './ArrowIcon'
import { AxeIcon } from './AxeIcon'
import { BootIcon } from './BootIcon'
import { BowIcon } from './BowIcon'
import { CrossedSwordsIcon } from './CrossedSwordsIcon'
import { FishIcon } from './FishIcon'
import { FistIcon } from './FistIcon'
import { FlameIcon } from './FlameIcon'
import { GemIcon } from './GemIcon'
import { HeartIcon } from './HeartIcon'
import { HouseIcon } from './HouseIcon'
import { MaskIcon } from './MaskIcon'
import { PawIcon } from './PawIcon'
import { PickaxeIcon } from './PickaxeIcon'
import { PotIcon } from './PotIcon'
import { PotionIcon } from './PotionIcon'
import { PrayerIcon } from './PrayerIcon'
import { RuneIcon } from './RuneIcon'
import { ShieldIcon } from './ShieldIcon'
import { SkullIcon } from './SkullIcon'
import { SproutIcon } from './SproutIcon'
import { StaffIcon } from './StaffIcon'

/** SkillName -> icon renderer, covering all 23 skills (see SKILL_NAMES). */
const ICONS: Record<SkillName, () => ReactElement> = {
  attack: () => <CrossedSwordsIcon />,
  strength: () => <FistIcon />,
  defence: () => <ShieldIcon />,
  hitpoints: () => <HeartIcon />,
  ranged: () => <BowIcon />,
  magic: () => <StaffIcon />,
  prayer: () => <PrayerIcon />,
  woodcutting: () => <AxeIcon />,
  mining: () => <PickaxeIcon />,
  fishing: () => <FishIcon />,
  cooking: () => <PotIcon />,
  firemaking: () => <FlameIcon />,
  smithing: () => <AnvilIcon />,
  crafting: () => <GemIcon />,
  fletching: () => <ArrowIcon />,
  runecraft: () => <RuneIcon />,
  herblore: () => <PotionIcon />,
  agility: () => <BootIcon />,
  thieving: () => <MaskIcon />,
  slayer: () => <SkullIcon />,
  farming: () => <SproutIcon />,
  construction: () => <HouseIcon />,
  hunter: () => <PawIcon />,
}

/** Inline SVG icon for a skill. The record is exhaustive over SkillName. */
export function SkillIcon({ skill }: { skill: SkillName }): ReactElement {
  return ICONS[skill]()
}
