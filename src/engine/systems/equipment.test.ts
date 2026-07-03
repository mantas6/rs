import { describe, expect, it } from 'vitest'
import { EventBus } from '../core/eventBus'
import { EQUIPMENT_SLOTS, Equipment, UNARMED_ATTACK_SPEED } from './equipment'
import { Inventory } from './inventory'
import { Skills, xpForLevel } from './skills'

const setup = () => {
  const events = new EventBus()
  return {
    events,
    inventory: new Inventory(events),
    equipment: new Equipment(events),
    skills: new Skills(events),
  }
}

describe('Equipment.equip', () => {
  it('equips from an inventory slot index', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('bronze_sword')
    expect(equipment.equip(inventory, skills, 0)).toBe(true)
    expect(equipment.get('weapon')).toEqual({ itemId: 'bronze_sword', quantity: 1 })
    expect(inventory.get(0)).toBeNull()
  })

  it('equips by item id (first matching slot)', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('logs')
    inventory.add('wooden_shield')
    expect(equipment.equip(inventory, skills, 'wooden_shield')).toBe(true)
    expect(equipment.get('shield')).toEqual({ itemId: 'wooden_shield', quantity: 1 })
    expect(inventory.count('wooden_shield')).toBe(0)
  })

  it('swaps with the currently equipped item', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('bronze_sword')
    inventory.add('bronze_scimitar')
    equipment.equip(inventory, skills, 'bronze_sword')
    expect(equipment.equip(inventory, skills, 'bronze_scimitar')).toBe(true)
    expect(equipment.get('weapon')).toEqual({ itemId: 'bronze_scimitar', quantity: 1 })
    expect(inventory.count('bronze_sword')).toBe(1)
    expect(inventory.count('bronze_scimitar')).toBe(0)
  })

  it('swaps even when the inventory is otherwise full (removal frees the slot)', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('bronze_sword')
    equipment.equip(inventory, skills, 'bronze_sword')
    inventory.add('bronze_scimitar')
    inventory.add('logs', 27)
    expect(inventory.isFull).toBe(true)
    expect(equipment.equip(inventory, skills, 'bronze_scimitar')).toBe(true)
    expect(equipment.get('weapon')).toEqual({ itemId: 'bronze_scimitar', quantity: 1 })
    expect(inventory.count('bronze_sword')).toBe(1)
  })

  it('rejects items whose skill requirements are not met', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('iron_axe') // requires attack 5
    expect(equipment.equip(inventory, skills, 0)).toBe(false)
    expect(equipment.get('weapon')).toBeNull()
    expect(inventory.count('iron_axe')).toBe(1) // unchanged
  })

  it('accepts once the base level meets the requirement', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('iron_axe')
    skills.addXp('attack', xpForLevel(5))
    expect(equipment.equip(inventory, skills, 0)).toBe(true)
    expect(equipment.get('weapon')).toEqual({ itemId: 'iron_axe', quantity: 1 })
  })

  it('checks BASE levels, ignoring boosts', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('iron_axe')
    skills.boost('attack', 10) // current level 11, base still 1
    expect(equipment.equip(inventory, skills, 0)).toBe(false)
  })

  it('rejects non-equipment items, empty slots, and missing item ids', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('logs')
    expect(equipment.equip(inventory, skills, 0)).toBe(false)
    expect(equipment.equip(inventory, skills, 5)).toBe(false)
    expect(equipment.equip(inventory, skills, 'bronze_sword')).toBe(false)
  })

  it('emits equipmentChanged', () => {
    const { events, inventory, equipment, skills } = setup()
    const seen: Array<{ slot: string; item: unknown }> = []
    events.on('equipmentChanged', (e) => seen.push(e))
    inventory.add('bronze_full_helm')
    equipment.equip(inventory, skills, 0)
    expect(seen).toEqual([
      { slot: 'head', item: { itemId: 'bronze_full_helm', quantity: 1 } },
    ])
  })
})

describe('Equipment.unequip', () => {
  it('moves the item back to the inventory and emits equipmentChanged', () => {
    const { events, inventory, equipment, skills } = setup()
    inventory.add('bronze_platebody')
    equipment.equip(inventory, skills, 0)
    const seen: Array<{ slot: string; item: unknown }> = []
    events.on('equipmentChanged', (e) => seen.push(e))
    expect(equipment.unequip('body', inventory)).toBe(true)
    expect(equipment.get('body')).toBeNull()
    expect(inventory.count('bronze_platebody')).toBe(1)
    expect(seen).toEqual([{ slot: 'body', item: null }])
  })

  it('fails gracefully when the inventory is full', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('bronze_sword')
    equipment.equip(inventory, skills, 0)
    inventory.add('logs', 28)
    expect(inventory.isFull).toBe(true)
    expect(equipment.unequip('weapon', inventory)).toBe(false)
    expect(equipment.get('weapon')).toEqual({ itemId: 'bronze_sword', quantity: 1 })
    expect(inventory.count('bronze_sword')).toBe(0)
  })

  it('returns false for empty slots', () => {
    const { inventory, equipment } = setup()
    expect(equipment.unequip('ring', inventory)).toBe(false)
  })
})

describe('Equipment.totalBonuses', () => {
  it('is all zeroes when nothing is equipped', () => {
    const { equipment } = setup()
    const bonuses = equipment.totalBonuses()
    for (const value of Object.values(bonuses)) expect(value).toBe(0)
  })

  it('sums bonuses across equipped items', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('bronze_scimitar')
    inventory.add('wooden_shield')
    inventory.add('bronze_full_helm')
    equipment.equip(inventory, skills, 'bronze_scimitar')
    equipment.equip(inventory, skills, 'wooden_shield')
    equipment.equip(inventory, skills, 'bronze_full_helm')
    const bonuses = equipment.totalBonuses()
    expect(bonuses.attackSlash).toBe(7)
    expect(bonuses.attackStab).toBe(1)
    expect(bonuses.meleeStrength).toBe(6)
    expect(bonuses.defenceStab).toBe(4 + 4)
    expect(bonuses.defenceSlash).toBe(5 + 5)
    expect(bonuses.defenceCrush).toBe(3 + 3)
    expect(bonuses.defenceMagic).toBe(-1 + -1)
    expect(bonuses.defenceRanged).toBe(4 + 4)
    expect(bonuses.attackMagic).toBe(-6)
    expect(bonuses.attackRanged).toBe(-2)
    expect(bonuses.prayer).toBe(0)
  })
})

describe('Equipment.weaponSpeed', () => {
  it('defaults to 4 when unarmed', () => {
    const { equipment } = setup()
    expect(equipment.weaponSpeed()).toBe(UNARMED_ATTACK_SPEED)
  })

  it('uses the equipped weapon speed', () => {
    const { inventory, equipment, skills } = setup()
    inventory.add('bronze_sword')
    equipment.equip(inventory, skills, 0)
    expect(equipment.weaponSpeed()).toBe(5)
    inventory.add('bronze_scimitar')
    equipment.equip(inventory, skills, 'bronze_scimitar')
    expect(equipment.weaponSpeed()).toBe(4)
  })
})

describe('EQUIPMENT_SLOTS', () => {
  it('lists all 11 slots', () => {
    expect(EQUIPMENT_SLOTS).toHaveLength(11)
    expect(new Set(EQUIPMENT_SLOTS).size).toBe(11)
  })
})
