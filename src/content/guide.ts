// Per-skill training guide. Data-only: plain typed objects, no logic.
//
// This is curated knowledge about how each skill is progressed, which items
// are involved, and how to obtain/access them. Item ids referenced in
// `itemIds` are the real ids from items.ts so the guide stays consistent with
// the rest of the content (see guide.test.ts, which enforces this).
//
// Type-only import from the engine (erased at runtime, so content stays free
// of engine code). skills.ts is the single source of truth for skill names.
import type { SkillName } from '../engine/systems/skills'

/** One ordered step in a skill's progression. */
export interface GuideStep {
  /** Base level in the skill at which this step becomes relevant. */
  level: number
  /** What to do at this stage. */
  action: string
  /** Item ids relevant to this step; each must exist in items.ts. */
  itemIds?: string[]
}

/** Guide entry for a single skill. */
export interface SkillGuideEntry {
  skill: SkillName
  /** One-line description of what the skill does and how it is trained. */
  summary: string
  /** True when the skill has real, playable training mechanics. */
  trainable: boolean
  /** Ordered progression steps (empty for not-yet-implemented skills). */
  steps: GuideStep[]
  /** Notes on where/how to obtain relevant items and access points. */
  notes: string[]
}

/**
 * Guide entry per skill. Keyed by SkillName so the record is exhaustive over
 * every skill at compile time — adding a skill to SKILL_NAMES forces an entry
 * here. Trainable skills describe real mechanics from resourceNodes.ts,
 * recipes.ts, npcs.ts and combat.ts; the rest exist in the XP model but have
 * no gameplay yet and say so honestly.
 */
export const skillGuides: Record<SkillName, SkillGuideEntry> = {
  attack: {
    skill: 'attack',
    summary:
      'Improves your accuracy in melee combat. Train it by fighting with the Accurate attack style.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Take the free Bronze sword and Wooden shield from the general store, equip them, set your attack style to Accurate, and attack chickens or cows.',
        itemIds: ['bronze_sword', 'wooden_shield'],
      },
      {
        level: 5,
        action:
          'Attack 5 unlocks the iron tools. Fight giant rats and goblins for tougher, faster targets.',
        itemIds: ['iron_axe', 'iron_pickaxe'],
      },
    ],
    notes: [
      'The Accurate style grants 4 Attack XP per point of damage dealt, plus Hitpoints XP.',
      'The general store counter and a bank booth are inside the Lumbridge castle courtyard where you spawn.',
    ],
  },
  strength: {
    skill: 'strength',
    summary:
      'Raises your maximum melee hit. Train it by fighting with the Aggressive attack style.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Set your attack style to Aggressive and fight melee monsters. Cows in the fenced field east of the river are sturdy, low-risk targets.',
        itemIds: ['bronze_sword'],
      },
    ],
    notes: [
      'The Aggressive style grants 4 Strength XP per point of damage dealt.',
      'The Controlled style instead splits XP evenly across Attack, Strength and Defence.',
    ],
  },
  defence: {
    skill: 'defence',
    summary:
      'Reduces how often enemies hit you. Train it by fighting with the Defensive attack style.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Set your attack style to Defensive and fight monsters. A Wooden shield adds defence while you train.',
        itemIds: ['wooden_shield'],
      },
    ],
    notes: [
      'The Defensive style grants 4 Defence XP per point of damage dealt.',
      'The Controlled style trains Defence alongside Attack and Strength.',
    ],
  },
  hitpoints: {
    skill: 'hitpoints',
    summary:
      'Your health pool. It rises automatically as you deal damage in any combat style, and starts at level 10.',
    trainable: true,
    steps: [
      {
        level: 10,
        action:
          'Every point of melee damage you deal grants Hitpoints XP, so any fighting trains it. Cook and eat food to heal between fights.',
        itemIds: ['shrimps', 'cooked_beef', 'cooked_chicken'],
      },
    ],
    notes: [
      'Hitpoints begins at level 10, unlike most skills which start at level 1.',
      'Current HP regenerates slowly over time; eating cooked food restores it faster.',
    ],
  },
  ranged: {
    skill: 'ranged',
    summary:
      'The ranged combat style of classic OSRS. Combat here is melee-only, so Ranged cannot be trained yet.',
    trainable: false,
    steps: [],
    notes: ['Only melee combat (Attack, Strength, Defence) is implemented in this version.'],
  },
  magic: {
    skill: 'magic',
    summary:
      'Casts spells in classic OSRS. Not yet implemented — there are no spells or runes in this version.',
    trainable: false,
    steps: [],
    notes: ['Only melee combat is implemented in this version.'],
  },
  prayer: {
    skill: 'prayer',
    summary:
      'Trained by burying bones dropped by monsters. Each bone buried grants Prayer XP. Activating prayers is not yet implemented.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Kill monsters such as chickens, cows, giant rats and goblins for Bones, then click the Bones in your inventory to bury them for 4.5 Prayer XP each.',
        itemIds: ['bones'],
      },
    ],
    notes: [
      'Bones are dropped by most monsters and buried straight from your inventory — no altar needed yet.',
      'Activating prayers to boost combat is not yet implemented in this version.',
    ],
  },
  woodcutting: {
    skill: 'woodcutting',
    summary: 'Chop trees for logs, which feed Firemaking. Needs an axe in your inventory or wielded.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Take the free Bronze axe from the general store and chop regular trees in the forest west of the castle for Logs (25 XP each).',
        itemIds: ['bronze_axe', 'logs'],
      },
      {
        level: 15,
        action: 'Woodcutting 15 lets you cut Oak trees for Oak logs (37.5 XP each).',
        itemIds: ['oak_logs'],
      },
    ],
    notes: [
      'The Bronze axe works from level 1; the Iron axe cuts faster but needs Woodcutting 5 to use.',
      'Trees stand in the forest west and south-west of the Lumbridge castle.',
    ],
  },
  mining: {
    skill: 'mining',
    summary: 'Mine rocks for ore. Needs a pickaxe in your inventory or wielded.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Grab the free Bronze pickaxe from the general store and mine Copper and Tin rocks in the south-east mine (17.5 XP each).',
        itemIds: ['bronze_pickaxe', 'copper_ore', 'tin_ore'],
      },
      {
        level: 15,
        action: 'Mining 15 lets you mine Iron rocks for Iron ore (35 XP each).',
        itemIds: ['iron_ore'],
      },
    ],
    notes: [
      'The mine is in the south-east, across the river bridge.',
      'The Bronze pickaxe works from level 1; the Iron pickaxe needs Mining 5 to use.',
      'Copper and Tin ore would become Bronze bars via Smithing, which is not yet available.',
    ],
  },
  fishing: {
    skill: 'fishing',
    summary: 'Catch fish at fishing spots. Needs the matching fishing tool.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Take the free Small fishing net and use the fishing spots on the west river bank to net Raw shrimps (10 XP each).',
        itemIds: ['small_fishing_net', 'raw_shrimps'],
      },
    ],
    notes: [
      'Two net fishing spots sit on the west bank of the river.',
      'Cook Raw shrimps on a fire or range to turn them into edible food.',
    ],
  },
  cooking: {
    skill: 'cooking',
    summary:
      'Cook raw food on a fire or range into food that heals you. Higher levels burn food less often.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Cook Raw shrimps, Raw beef or Raw chicken on the kitchen range or a fire (30 XP each). They stop burning at level 34.',
        itemIds: [
          'raw_shrimps',
          'shrimps',
          'raw_beef',
          'cooked_beef',
          'raw_chicken',
          'cooked_chicken',
        ],
      },
      {
        level: 15,
        action: 'Cooking 15 unlocks Raw trout (70 XP), which stops burning at level 49.',
        itemIds: ['raw_trout', 'trout'],
      },
    ],
    notes: [
      'A cooking range sits in the kitchen house east of the castle; otherwise light a fire with logs and a tinderbox and cook on that.',
      'Raw beef comes from cows, Raw chicken from chickens, and Raw shrimps from fishing.',
      'Raw trout has a recipe defined but there is currently no fishing spot that yields it.',
    ],
  },
  firemaking: {
    skill: 'firemaking',
    summary:
      'Burn logs with a tinderbox to create fires, which also double as cooking spots.',
    trainable: true,
    steps: [
      {
        level: 1,
        action: 'Use a Tinderbox on Logs to light a fire (40 XP). The fire lingers and can be cooked on.',
        itemIds: ['tinderbox', 'logs'],
      },
      {
        level: 15,
        action: 'Firemaking 15 lets you light Oak logs (60 XP), which burn longer.',
        itemIds: ['oak_logs'],
      },
    ],
    notes: [
      'Get logs from Woodcutting and a free Tinderbox from the general store.',
      'Fires double as cooking sources when you are away from the kitchen range.',
    ],
  },
  smithing: {
    skill: 'smithing',
    summary:
      'Smelt ore into metal bars at a furnace. Bars are the raw material for forging equipment.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Mine Copper and Tin ore, then use the furnace to smelt one of each into a Bronze bar (6.2 XP).',
        itemIds: ['copper_ore', 'tin_ore', 'bronze_bar'],
      },
      {
        level: 15,
        action:
          'Smithing 15 lets you smelt Iron ore into Iron bars (12.5 XP), but iron only smelts successfully half the time and the ore is lost on a failed attempt.',
        itemIds: ['iron_ore', 'iron_bar'],
      },
    ],
    notes: [
      'The furnace stands on the plains just west of the south-eastern mine, so you can smelt the ore you dig without a long trek.',
      'A Bronze bar needs one Copper and one Tin ore; an Iron bar needs a single Iron ore.',
      'Forging bars into weapons and armour at an anvil is not yet implemented.',
    ],
  },
  crafting: {
    skill: 'crafting',
    summary:
      'Makes jewellery, armour and more from raw materials in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: ['Cows drop Cowhide, which Crafting would turn into leather once implemented.'],
  },
  fletching: {
    skill: 'fletching',
    summary:
      'Turns logs into bows and arrows in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: [],
  },
  runecraft: {
    skill: 'runecraft',
    summary: 'Crafts runes at altars in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: [],
  },
  herblore: {
    skill: 'herblore',
    summary: 'Brews potions from herbs in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: [],
  },
  agility: {
    skill: 'agility',
    summary:
      'Traverses obstacle courses and boosts run energy in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: [],
  },
  thieving: {
    skill: 'thieving',
    summary:
      'Pickpockets NPCs and loots stalls in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: [],
  },
  slayer: {
    skill: 'slayer',
    summary:
      'Assigns monster-killing tasks in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: [],
  },
  farming: {
    skill: 'farming',
    summary: 'Grows crops in patches over time in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: [],
  },
  construction: {
    skill: 'construction',
    summary:
      'Builds and furnishes a player house in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: [],
  },
  hunter: {
    skill: 'hunter',
    summary: 'Traps creatures across the world in classic OSRS. Not yet implemented in this version.',
    trainable: false,
    steps: [],
    notes: [],
  },
}
