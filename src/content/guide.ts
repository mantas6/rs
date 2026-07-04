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
      {
        level: 10,
        action: 'Attack 10 unlocks the steel tools, which hit harder still.',
        itemIds: ['steel_axe', 'steel_pickaxe'],
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
      'The ranged combat style: wield a bow with arrows equipped and attack from a distance. Trained by dealing damage with a bow.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Fletch or buy a Shortbow, equip it with Bronze arrows in the ammo slot, set your attack style, and shoot chickens or cows from a few tiles away.',
        itemIds: ['shortbow', 'bronze_arrow'],
      },
      {
        level: 1,
        action:
          'The Longbow trades attack speed for greater range. Use the Rapid style to fire faster or Accurate for better aim.',
        itemIds: ['longbow'],
      },
      {
        level: 5,
        action: 'Ranged 5 lets you wield the sturdier Oak shortbow for a bigger ranged bonus.',
        itemIds: ['oak_shortbow'],
      },
    ],
    notes: [
      'Each shot consumes one arrow from the ammo slot; with no arrows equipped a bow cannot fire.',
      'Accurate grants a small accuracy bonus; Rapid fires one tick faster. Both train Ranged (plus Hitpoints).',
      'Bows are two-handed, so they occupy the weapon slot and clear any shield.',
    ],
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
      'Trained by burying bones dropped by monsters. Each bone buried grants Prayer XP and raises your prayer points, letting you activate combat prayers that boost your fighting stats.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Kill monsters such as chickens, cows, giant rats and goblins for Bones, then click the Bones in your inventory to bury them for 4.5 Prayer XP each.',
        itemIds: ['bones'],
      },
      {
        level: 1,
        action:
          'Open the Prayer tab and switch on a prayer such as Thick Skin (+5% Defence), Burst of Strength (+5% Strength) or Clarity of Thought (+5% Attack) before a fight. Higher tiers unlock at higher Prayer levels.',
      },
    ],
    notes: [
      'Bones are dropped by most monsters and buried straight from your inventory — no altar needed yet.',
      'Your Prayer level is both your maximum prayer points and the level requirement gate: higher-level prayers give bigger combat boosts but drain points faster.',
      'Active prayers drain prayer points over time and all switch off when points hit 0 or you die. Points slowly regenerate on their own; keep burying bones to raise the maximum.',
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
      'The Bronze axe works from level 1; the Iron axe cuts faster but needs Woodcutting 5, and the Steel axe faster still at Woodcutting 10.',
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
      {
        level: 20,
        action: 'Mining 20 lets you mine Steel rocks for Steel ore (37.5 XP each).',
        itemIds: ['steel_ore'],
      },
    ],
    notes: [
      'The mine is in the south-east, across the river bridge.',
      'The Bronze pickaxe works from level 1; the Iron pickaxe needs Mining 5 and the Steel pickaxe Mining 10 to use.',
      'Smelt Copper and Tin ore into Bronze bars at the furnace via Smithing, then forge the bars into gear at the anvil.',
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
      'Smelt ore into metal bars at a furnace, then forge those bars into weapons and armour at an anvil.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Mine Copper and Tin ore, then use the furnace to smelt one of each into a Bronze bar (6.2 XP).',
        itemIds: ['copper_ore', 'tin_ore', 'bronze_bar'],
      },
      {
        level: 1,
        action:
          'Take Bronze bars to the anvil beside the furnace and hammer them into gear: a Bronze axe or sword (1 bar, 12.5 XP), later a Bronze scimitar or full helm (2 bars, 25 XP).',
        itemIds: ['bronze_bar', 'bronze_axe', 'bronze_sword', 'bronze_scimitar', 'bronze_full_helm'],
      },
      {
        level: 15,
        action:
          'Smithing 15 lets you smelt Iron ore into Iron bars (12.5 XP), but iron only smelts successfully half the time and the ore is lost on a failed attempt.',
        itemIds: ['iron_ore', 'iron_bar'],
      },
      {
        level: 16,
        action:
          'Smithing 16 unlocks Bronze platelegs (3 bars, 37.5 XP) at the anvil, and Smithing 18 the Bronze platebody (5 bars, 62.5 XP).',
        itemIds: ['bronze_bar', 'bronze_platelegs', 'bronze_platebody'],
      },
      {
        level: 20,
        action:
          'Smithing 20 lets you smelt Steel ore into Steel bars (17.5 XP), which always succeeds.',
        itemIds: ['steel_ore', 'steel_bar'],
      },
    ],
    notes: [
      'The furnace and anvil stand on the plains just west of the south-eastern mine, so you can smelt the ore you dig and forge the bars without a long trek.',
      'A Bronze bar needs one Copper and one Tin ore; an Iron bar needs a single Iron ore.',
      'Forging always succeeds: each attempt consumes the required bars and yields the item plus 12.5 Smithing XP per bar used.',
    ],
  },
  crafting: {
    skill: 'crafting',
    summary:
      'Turns cowhide into leather at a tannery, then sews the leather into armour with a needle and thread.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Kill cows for Cowhide, tan it into Leather at the tannery, then use a Needle and Thread (both free from the general store) to sew Leather gloves (13.8 XP each).',
        itemIds: ['cowhide', 'leather', 'needle', 'thread', 'leather_gloves'],
      },
      {
        level: 7,
        action: 'Crafting 7 lets you sew Leather boots (16.25 XP each).',
        itemIds: ['leather', 'leather_boots'],
      },
      {
        level: 14,
        action: 'Crafting 14 unlocks the Leather body (25 XP each), a solid early chest piece.',
        itemIds: ['leather', 'leather_body'],
      },
      {
        level: 18,
        action: 'Crafting 18 unlocks Leather chaps (27 XP each) for the legs slot.',
        itemIds: ['leather', 'leather_chaps'],
      },
    ],
    notes: [
      'Cows in the fenced field east of the river drop Cowhide; a tannery stands on the plains just east of that field.',
      'Tanning a hide into Leather is free and grants no XP — the Crafting XP comes from sewing the leather into equipment.',
      'A Needle is reusable, but each item sewn consumes one Thread. Both are stocked free at the Lumbridge general store.',
    ],
  },
  fletching: {
    skill: 'fletching',
    summary:
      'Carve logs into arrow shafts and unstrung bows with a knife, string bows into usable weapons, and build arrows.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Buy a Knife from the general store, then use it on Logs to carve a batch of 15 Arrow shafts (5 XP each).',
        itemIds: ['knife', 'logs', 'arrow_shafts'],
      },
      {
        level: 1,
        action:
          'Add a Feather to Arrow shafts to make Headless arrows (1 XP), then add Bronze arrowtips to make Bronze arrows (1.3 XP) — ammo for your bows.',
        itemIds: ['arrow_shafts', 'feather', 'headless_arrow', 'bronze_arrowtips', 'bronze_arrow'],
      },
      {
        level: 5,
        action:
          'Fletching 5 lets you carve Logs into an unstrung Shortbow (5 XP), then add a Bow string to finish a Shortbow (5 XP) you can wield.',
        itemIds: ['logs', 'shortbow_u', 'bowstring', 'shortbow'],
      },
      {
        level: 10,
        action:
          'Fletching 10 lets you carve an unstrung Longbow (10 XP) and string it into a Longbow (10 XP).',
        itemIds: ['logs', 'longbow_u', 'bowstring', 'longbow'],
      },
      {
        level: 20,
        action:
          'Fletching 20 lets you carve Oak logs into an unstrung Oak shortbow (16.5 XP) and string it into an Oak shortbow (16.5 XP).',
        itemIds: ['oak_logs', 'oak_shortbow_u', 'bowstring', 'oak_shortbow'],
      },
    ],
    notes: [
      'The Knife is kept when carving; only the logs are consumed. It is stocked at the Lumbridge general store.',
      'Get logs from Woodcutting: regular Logs from trees and Oak logs from oak trees.',
      'Bow strings and bronze arrowtips are stocked free at the Lumbridge general store; feathers drop from chickens.',
      'String an unstrung bow with a Bow string to make a wieldable Ranged weapon; combine shafts, feathers and arrowtips into arrows for ammo.',
    ],
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
    summary:
      'Clean grimy herbs, mix them into unfinished potions with a vial of water, then finish them with a secondary ingredient into potions that temporarily boost your combat stats.',
    trainable: true,
    steps: [
      {
        level: 3,
        action:
          'Kill goblins for Grimy guam, clean it into a Guam leaf (2.5 XP), then use the leaf on a Vial of water to make a Guam potion (unf) — no XP, no level needed.',
        itemIds: ['grimy_guam', 'guam_leaf', 'vial_of_water', 'guam_potion_unf'],
      },
      {
        level: 3,
        action:
          'Add an Eye of newt to a Guam potion (unf) to brew an Attack potion (25 XP). Drink it to temporarily raise your Attack level for combat.',
        itemIds: ['guam_potion_unf', 'eye_of_newt', 'attack_potion'],
      },
      {
        level: 11,
        action:
          'Herblore 11 lets you clean Grimy tarromin into Tarromin (5 XP) and mix it with a Vial of water into a Tarromin potion (unf).',
        itemIds: ['grimy_tarromin', 'tarromin', 'vial_of_water', 'tarromin_potion_unf'],
      },
      {
        level: 12,
        action:
          'Add a Limpwurt root to a Tarromin potion (unf) to brew a Strength potion (50 XP). Drink it to temporarily raise your Strength level for combat.',
        itemIds: ['tarromin_potion_unf', 'limpwurt_root', 'strength_potion'],
      },
    ],
    notes: [
      'Grimy guam and grimy tarromin are dropped by goblins across the river; clean them straight from your inventory.',
      'Vials of water, eyes of newt and limpwurt roots are stocked free at the Lumbridge general store.',
      'Potion boosts decay one level per minute back toward your base level, just like other temporary boosts.',
    ],
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
    summary:
      'Plant seeds in allotment patches, wait for them to grow over time, then harvest the produce for XP.',
    trainable: true,
    steps: [
      {
        level: 1,
        action:
          'Take free Potato seeds from the general store, walk to the allotment patches in the clearing south of the castle, and plant a seed in an empty patch (8 XP).',
        itemIds: ['potato_seed', 'potato'],
      },
      {
        level: 1,
        action:
          'Wait for the crop to grow through its stages, then harvest the fully grown patch for several Potatoes (9 XP each). The patch empties and can be replanted.',
        itemIds: ['potato'],
      },
      {
        level: 5,
        action: 'Farming 5 lets you plant Onion seeds for Onions (10.5 XP per onion harvested).',
        itemIds: ['onion_seed', 'onion'],
      },
      {
        level: 7,
        action: 'Farming 7 lets you plant Cabbage seeds for Cabbages (11.5 XP per cabbage harvested).',
        itemIds: ['cabbage_seed', 'cabbage'],
      },
    ],
    notes: [
      'Allotment patches sit in the open clearing just south of the Lumbridge castle.',
      'Seeds (potato, onion, cabbage) are stocked free at the Lumbridge general store.',
      'Crops grow on their own as game ticks pass; you can wander off and come back to harvest.',
      'Harvested produce is edible food that heals a little when eaten.',
    ],
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
