import { describe, expect, it } from 'vitest'
import { EventBus } from '../core/eventBus'
import { INVENTORY_SIZE, Inventory, MAX_STACK, type ItemStack } from './inventory'

const makeInventory = () => {
  const events = new EventBus()
  return { events, inventory: new Inventory(events) }
}

describe('Inventory.add', () => {
  it('non-stackable items fill separate slots with quantity 1', () => {
    const { inventory } = makeInventory()
    expect(inventory.add('logs', 3)).toBe(3)
    expect(inventory.get(0)).toEqual({ itemId: 'logs', quantity: 1 })
    expect(inventory.get(1)).toEqual({ itemId: 'logs', quantity: 1 })
    expect(inventory.get(2)).toEqual({ itemId: 'logs', quantity: 1 })
    expect(inventory.get(3)).toBeNull()
    expect(inventory.freeSlots).toBe(INVENTORY_SIZE - 3)
  })

  it('stackable items merge into a single slot', () => {
    const { inventory } = makeInventory()
    expect(inventory.add('coins', 100)).toBe(100)
    expect(inventory.add('coins', 50)).toBe(50)
    expect(inventory.get(0)).toEqual({ itemId: 'coins', quantity: 150 })
    expect(inventory.freeSlots).toBe(INVENTORY_SIZE - 1)
  })

  it('stackable quantity caps at MAX_STACK with a partial add', () => {
    const { inventory } = makeInventory()
    inventory.add('coins', MAX_STACK - 5)
    expect(inventory.add('coins', 10)).toBe(5)
    expect(inventory.get(0)).toEqual({ itemId: 'coins', quantity: MAX_STACK })
    expect(inventory.add('coins', 1)).toBe(0)
  })

  it('respects the 28-slot cap and allows partial adds of non-stackables', () => {
    const { inventory } = makeInventory()
    expect(inventory.add('logs', 26)).toBe(26)
    expect(inventory.add('bones', 5)).toBe(2)
    expect(inventory.isFull).toBe(true)
    expect(inventory.freeSlots).toBe(0)
    expect(inventory.add('bones', 1)).toBe(0)
  })

  it('a full inventory still accepts stackables that merge into an existing stack', () => {
    const { inventory } = makeInventory()
    inventory.add('coins', 10)
    inventory.add('logs', 27)
    expect(inventory.isFull).toBe(true)
    expect(inventory.add('coins', 5)).toBe(5)
    expect(inventory.count('coins')).toBe(15)
  })

  it('fills gaps left by removed items', () => {
    const { inventory } = makeInventory()
    inventory.add('logs', 3)
    inventory.removeSlot(1)
    inventory.add('bones')
    expect(inventory.get(1)).toEqual({ itemId: 'bones', quantity: 1 })
  })

  it('rejects unknown items and invalid quantities', () => {
    const { inventory } = makeInventory()
    expect(() => inventory.add('not_an_item')).toThrow(/Unknown item/)
    expect(() => inventory.add('logs', 0)).toThrow()
    expect(() => inventory.add('logs', 1.5)).toThrow()
  })
})

describe('Inventory.remove', () => {
  it('removes non-stackables across multiple slots', () => {
    const { inventory } = makeInventory()
    inventory.add('logs', 4)
    inventory.add('bones', 1)
    expect(inventory.remove('logs', 3)).toBe(3)
    expect(inventory.count('logs')).toBe(1)
    // Bones untouched, in slot 4.
    expect(inventory.get(4)).toEqual({ itemId: 'bones', quantity: 1 })
  })

  it('removes partially from a stack and clears the slot when emptied', () => {
    const { inventory } = makeInventory()
    inventory.add('coins', 100)
    expect(inventory.remove('coins', 30)).toBe(30)
    expect(inventory.get(0)).toEqual({ itemId: 'coins', quantity: 70 })
    expect(inventory.remove('coins', 70)).toBe(70)
    expect(inventory.get(0)).toBeNull()
  })

  it('returns only what was available', () => {
    const { inventory } = makeInventory()
    inventory.add('logs', 2)
    expect(inventory.remove('logs', 5)).toBe(2)
    expect(inventory.remove('logs')).toBe(0)
  })
})

describe('Inventory.count / has', () => {
  it('counts across slots and stacks', () => {
    const { inventory } = makeInventory()
    inventory.add('logs', 3)
    inventory.add('coins', 250)
    expect(inventory.count('logs')).toBe(3)
    expect(inventory.count('coins')).toBe(250)
    expect(inventory.count('bones')).toBe(0)
    expect(inventory.has('logs')).toBe(true)
    expect(inventory.has('logs', 3)).toBe(true)
    expect(inventory.has('logs', 4)).toBe(false)
    expect(inventory.has('bones')).toBe(false)
  })
})

describe('Inventory.removeSlot', () => {
  it('removes the whole stack by default', () => {
    const { inventory } = makeInventory()
    inventory.add('coins', 100)
    expect(inventory.removeSlot(0)).toEqual({ itemId: 'coins', quantity: 100 })
    expect(inventory.get(0)).toBeNull()
  })

  it('removes a partial quantity from a stack', () => {
    const { inventory } = makeInventory()
    inventory.add('coins', 100)
    expect(inventory.removeSlot(0, 40)).toEqual({ itemId: 'coins', quantity: 40 })
    expect(inventory.get(0)).toEqual({ itemId: 'coins', quantity: 60 })
  })

  it('returns null for empty slots and validates the index', () => {
    const { inventory } = makeInventory()
    expect(inventory.removeSlot(5)).toBeNull()
    expect(() => inventory.removeSlot(-1)).toThrow()
    expect(() => inventory.removeSlot(INVENTORY_SIZE)).toThrow()
  })
})

describe('Inventory.swap', () => {
  it('swaps two filled slots', () => {
    const { inventory } = makeInventory()
    inventory.add('logs', 1)
    inventory.add('bones', 1)
    inventory.swap(0, 1)
    expect(inventory.get(0)).toEqual({ itemId: 'bones', quantity: 1 })
    expect(inventory.get(1)).toEqual({ itemId: 'logs', quantity: 1 })
  })

  it('moves an item into an empty slot', () => {
    const { inventory } = makeInventory()
    inventory.add('logs', 1)
    inventory.swap(0, 5)
    expect(inventory.get(0)).toBeNull()
    expect(inventory.get(5)).toEqual({ itemId: 'logs', quantity: 1 })
  })

  it('validates indices', () => {
    const { inventory } = makeInventory()
    expect(() => inventory.swap(-1, 0)).toThrow()
    expect(() => inventory.swap(0, INVENTORY_SIZE)).toThrow()
    expect(() => inventory.swap(0, 1.5)).toThrow()
  })

  it('emits inventoryChanged only when contents actually move', () => {
    const { events, inventory } = makeInventory()
    inventory.add('logs', 1)
    let calls = 0
    events.on('inventoryChanged', () => calls++)
    inventory.swap(0, 0) // same slot
    inventory.swap(5, 6) // both empty
    expect(calls).toBe(0)
    inventory.swap(0, 1) // moves the log
    expect(calls).toBe(1)
  })
})

describe('Inventory.clear', () => {
  it('empties every slot', () => {
    const { inventory } = makeInventory()
    inventory.add('logs', 5)
    inventory.add('coins', 100)
    inventory.clear()
    expect(inventory.freeSlots).toBe(INVENTORY_SIZE)
    expect(inventory.count('logs')).toBe(0)
  })
})

describe('inventoryChanged events', () => {
  it('emits on add, remove, removeSlot, and clear — with settled slots', () => {
    const { events, inventory } = makeInventory()
    const seen: Array<ReadonlyArray<Readonly<ItemStack> | null>> = []
    events.on('inventoryChanged', (e) => seen.push([...e.slots]))

    inventory.add('logs', 2)
    inventory.remove('logs', 1) // clears slot 0
    inventory.removeSlot(1)
    inventory.add('coins', 10)
    inventory.clear()

    expect(seen).toHaveLength(5)
    expect(seen[0][0]).toEqual({ itemId: 'logs', quantity: 1 })
    expect(seen[0][1]).toEqual({ itemId: 'logs', quantity: 1 })
    expect(seen[2].every((s) => s === null)).toBe(true)
    expect(seen[3][0]).toEqual({ itemId: 'coins', quantity: 10 })
  })

  it('does not emit when nothing changes', () => {
    const { events, inventory } = makeInventory()
    let calls = 0
    events.on('inventoryChanged', () => calls++)
    inventory.remove('logs', 1) // nothing to remove
    inventory.clear() // already empty
    inventory.add('logs', 28)
    calls = 0
    inventory.add('bones', 1) // full — nothing added
    expect(calls).toBe(0)
  })
})
