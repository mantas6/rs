import { describe, expect, it } from 'vitest'
import { SKILL_NAMES } from '../engine/systems/skills'
import { skillGuides } from './guide'
import { items } from './items'

describe('skillGuides', () => {
  it('has exactly one entry per skill', () => {
    expect(Object.keys(skillGuides).sort()).toEqual([...SKILL_NAMES].sort())
  })

  it('keys the record by the entry skill', () => {
    for (const skill of SKILL_NAMES) {
      expect(skillGuides[skill].skill).toBe(skill)
    }
  })

  it('gives every skill a non-empty summary', () => {
    for (const skill of SKILL_NAMES) {
      expect(skillGuides[skill].summary.length).toBeGreaterThan(0)
    }
  })

  it('gives every trainable skill at least one progression step', () => {
    for (const skill of SKILL_NAMES) {
      const entry = skillGuides[skill]
      if (entry.trainable) expect(entry.steps.length).toBeGreaterThan(0)
      else expect(entry.steps).toHaveLength(0)
    }
  })

  it('references only item ids that exist in items.ts', () => {
    for (const skill of SKILL_NAMES) {
      for (const step of skillGuides[skill].steps) {
        for (const itemId of step.itemIds ?? []) {
          expect(items[itemId], `${skill} references unknown item "${itemId}"`).toBeDefined()
        }
      }
    }
  })

  it('lists steps in non-decreasing level order', () => {
    for (const skill of SKILL_NAMES) {
      const levels = skillGuides[skill].steps.map((step) => step.level)
      const sorted = [...levels].sort((a, b) => a - b)
      expect(levels).toEqual(sorted)
    }
  })
})
