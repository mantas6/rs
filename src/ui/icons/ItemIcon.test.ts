import { describe, expect, it } from 'vitest'
import { items } from '../../content/items'
import { hasItemIcon } from './ItemIcon'

describe('ItemIcon', () => {
  it('has a dedicated icon for every defined item (no generic fallback)', () => {
    const missing = Object.keys(items).filter((id) => !hasItemIcon(id))
    expect(missing).toEqual([])
  })
})
