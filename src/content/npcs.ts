// NPC definitions. Data-only: plain objects, no logic.
//
// Combat stats approximate early-game OSRS monsters. Drop tables: every
// `always` entry drops on each death, then one weighted roll is made across
// `entries` — an entry with `itemId: null` is the explicit "nothing" result.
// Respawn times approximate OSRS values in 600ms ticks.
import type { NpcDef } from './types'

export const npcs: Record<string, NpcDef> = {
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    examine: 'An ugly green creature.',
    combat: {
      hitpoints: 5,
      attackLevel: 1,
      strengthLevel: 1,
      defenceLevel: 1,
      attackBonus: 0,
      strengthBonus: 0,
      defenceBonuses: { stab: 0, slash: 0, crush: 0 },
      attackSpeed: 4,
      aggressive: true,
      attackRange: 1,
    },
    respawnTicks: 25,
    drops: {
      always: [{ itemId: 'bones', quantity: 1 }],
      entries: [
        { itemId: null, quantity: 1, weight: 5 },
        { itemId: 'coins', quantity: [1, 5], weight: 4 },
        { itemId: 'bronze_sword', quantity: 1, weight: 1 },
        { itemId: 'grimy_guam', quantity: 1, weight: 2 },
        { itemId: 'grimy_tarromin', quantity: 1, weight: 1 },
      ],
    },
  },
  giant_rat: {
    id: 'giant_rat',
    name: 'Giant rat',
    examine: 'Overgrown vermin.',
    combat: {
      hitpoints: 5,
      attackLevel: 2,
      strengthLevel: 3,
      defenceLevel: 2,
      attackBonus: 0,
      strengthBonus: 0,
      defenceBonuses: { stab: 0, slash: 0, crush: 0 },
      attackSpeed: 4,
      aggressive: true,
      attackRange: 1,
    },
    respawnTicks: 25,
    drops: {
      always: [{ itemId: 'bones', quantity: 1 }],
      entries: [],
    },
  },
  cow: {
    id: 'cow',
    name: 'Cow',
    examine: 'Converts grass to beef.',
    combat: {
      hitpoints: 8,
      attackLevel: 1,
      strengthLevel: 1,
      defenceLevel: 1,
      attackBonus: 0,
      strengthBonus: 0,
      defenceBonuses: { stab: 0, slash: 0, crush: 0 },
      attackSpeed: 4,
      aggressive: false,
      attackRange: 1,
    },
    respawnTicks: 25,
    drops: {
      always: [
        { itemId: 'bones', quantity: 1 },
        { itemId: 'cowhide', quantity: 1 },
        { itemId: 'raw_beef', quantity: 1 },
      ],
      entries: [],
    },
  },
  chicken: {
    id: 'chicken',
    name: 'Chicken',
    examine: 'Yep, definitely a chicken.',
    combat: {
      hitpoints: 3,
      attackLevel: 1,
      strengthLevel: 1,
      defenceLevel: 1,
      attackBonus: 0,
      strengthBonus: 0,
      defenceBonuses: { stab: 0, slash: 0, crush: 0 },
      attackSpeed: 4,
      aggressive: false,
      attackRange: 1,
    },
    respawnTicks: 25,
    drops: {
      always: [
        { itemId: 'bones', quantity: 1 },
        { itemId: 'raw_chicken', quantity: 1 },
      ],
      entries: [
        { itemId: 'feather', quantity: [5, 15], weight: 3 },
        { itemId: null, quantity: 1, weight: 1 },
      ],
    },
  },
}
