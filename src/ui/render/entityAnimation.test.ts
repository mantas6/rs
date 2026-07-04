import { describe, expect, it } from 'vitest'
import type { MoverLerp } from './constants'
import { selectNpcPose, selectPlayerPose } from './entityAnimation'

const still: MoverLerp = { px: 2, py: 2, cx: 2, cy: 2 }
const moving: MoverLerp = { px: 2, py: 2, cx: 2, cy: 3 }

describe('selectPlayerPose', () => {
  const base = {
    dying: false,
    walking: false,
    state: still,
    actionKind: undefined,
    actionTarget: null,
    playerPosition: { x: 2, y: 2 },
    bankOpen: false,
    shopOpen: false,
  }

  it('death overrides everything else', () => {
    expect(
      selectPlayerPose({ ...base, dying: true, walking: true, actionKind: 'mining' }).pose,
    ).toBe('death')
  })

  it('walking beats an active action and faces the movement direction', () => {
    const result = selectPlayerPose({
      ...base,
      walking: true,
      state: moving,
      actionKind: 'mining',
    })
    expect(result.pose).toBe('walk')
    // Moving +y (south) → yaw atan2(0, +1) === 0.
    expect(result.faceTarget).toBe(0)
  })

  it('maps an action kind through ACTION_POSE and faces its target', () => {
    const result = selectPlayerPose({
      ...base,
      actionKind: 'woodcutting',
      actionTarget: { x: 3, y: 2 },
    })
    expect(result.pose).toBe('chop')
    // Target one tile +x (east) → yaw atan2(+1, 0) === PI/2.
    expect(result.faceTarget).toBeCloseTo(Math.PI / 2, 10)
  })

  it('falls back to the bank pose when a bank/shop is open', () => {
    expect(selectPlayerPose({ ...base, bankOpen: true }).pose).toBe('bank')
    expect(selectPlayerPose({ ...base, shopOpen: true }).pose).toBe('bank')
  })

  it('idles with no facing change when nothing applies', () => {
    const result = selectPlayerPose(base)
    expect(result.pose).toBe('idle')
    expect(result.faceTarget).toBeNull()
  })
})

describe('selectNpcPose', () => {
  const base = {
    dying: false,
    walking: false,
    state: still,
    targetPosition: null,
    npcPosition: { x: 5, y: 5 },
  }

  it('death overrides walking and combat', () => {
    expect(
      selectNpcPose({ ...base, dying: true, walking: true, targetPosition: { x: 6, y: 5 } }).pose,
    ).toBe('death')
  })

  it('walking beats combat and faces the movement direction', () => {
    const result = selectNpcPose({
      ...base,
      walking: true,
      state: moving,
      targetPosition: { x: 6, y: 5 },
    })
    expect(result.pose).toBe('walk')
    expect(result.faceTarget).toBe(0)
  })

  it('enters a combat stance facing its target', () => {
    const result = selectNpcPose({ ...base, targetPosition: { x: 5, y: 4 } })
    expect(result.pose).toBe('combat')
    // Target one tile -y (north) → yaw atan2(0, -1) === PI.
    expect(result.faceTarget).toBeCloseTo(Math.PI, 10)
  })

  it('idles when not moving and with no target', () => {
    const result = selectNpcPose(base)
    expect(result.pose).toBe('idle')
    expect(result.faceTarget).toBeNull()
  })
})
