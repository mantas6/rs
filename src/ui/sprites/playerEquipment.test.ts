import { describe, expect, it } from 'vitest'
import type { EquipmentSlot } from '../../content/types'
import { createPlayerMesh } from './playerMesh'
import { updatePlayerEquipment, type EquippedItemLookup } from './playerEquipment'
import { SpriteResources } from './resources'

/** A lookup backed by a plain slot -> itemId record. */
function lookup(worn: Partial<Record<EquipmentSlot, string>>): EquippedItemLookup {
  return (slot) => worn[slot] ?? null
}

describe('updatePlayerEquipment', () => {
  it('starts with empty gear anchors', () => {
    const res = new SpriteResources()
    const { gear } = createPlayerMesh(res, 0, 0)
    for (const anchor of [gear.weapon, gear.shield, gear.head, gear.body, gear.cape, ...gear.legs]) {
      expect(anchor.children).toHaveLength(0)
    }
    res.dispose()
  })

  it('populates every visible slot from the current equipment', () => {
    const res = new SpriteResources()
    const view = createPlayerMesh(res, 0, 0)
    updatePlayerEquipment(
      res,
      view,
      lookup({
        weapon: 'bronze_sword',
        shield: 'wooden_shield',
        head: 'bronze_full_helm',
        body: 'bronze_platebody',
        legs: 'bronze_platelegs',
      }),
    )
    const { gear } = view
    expect(gear.weapon.children.length).toBeGreaterThan(0)
    expect(gear.shield.children.length).toBeGreaterThan(0)
    expect(gear.head.children.length).toBeGreaterThan(0)
    expect(gear.body.children.length).toBeGreaterThan(0)
    // Leg guards are built per leg so they stride independently.
    expect(gear.legs[0].children.length).toBeGreaterThan(0)
    expect(gear.legs[1].children.length).toBeGreaterThan(0)
    // No cape item equipped -> the back stays bare.
    expect(gear.cape.children).toHaveLength(0)
    res.dispose()
  })

  it('clears gear when a slot empties', () => {
    const res = new SpriteResources()
    const view = createPlayerMesh(res, 0, 0)
    updatePlayerEquipment(res, view, lookup({ weapon: 'bronze_scimitar' }))
    expect(view.gear.weapon.children.length).toBeGreaterThan(0)

    updatePlayerEquipment(res, view, lookup({}))
    expect(view.gear.weapon.children).toHaveLength(0)
    res.dispose()
  })

  it('never accumulates children when rebuilt repeatedly', () => {
    const res = new SpriteResources()
    const view = createPlayerMesh(res, 0, 0)
    for (let i = 0; i < 5; i++) {
      updatePlayerEquipment(res, view, lookup({ weapon: 'bronze_sword' }))
    }
    // Exactly one held-weapon group, no matter how many rebuilds ran.
    expect(view.gear.weapon.children).toHaveLength(1)
    res.dispose()
  })
})
