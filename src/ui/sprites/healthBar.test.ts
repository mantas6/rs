import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { Game, type NpcPlacement } from '../../engine'
import { createHealthBar, updateHealthBar } from './healthBar'
import { createNpcMesh } from './npcMesh'
import { SpriteResources } from './resources'

const IDENTITY = new THREE.Quaternion()

/** World-space [minX, maxX] extent of the fill mesh after a matrix update. */
function fillExtentX(fill: THREE.Mesh, root: THREE.Object3D): [number, number] {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(fill)
  return [box.min.x, box.max.x]
}

describe('updateHealthBar', () => {
  it('hides the bar at full health and shows it once damaged', () => {
    const res = new SpriteResources()
    const view = createHealthBar(res, 1)

    updateHealthBar(view, 10, 10, IDENTITY)
    expect(view.hpBar.visible).toBe(false)

    updateHealthBar(view, 7, 10, IDENTITY)
    expect(view.hpBar.visible).toBe(true)
    res.dispose()
  })

  it('re-applies the current hp fraction on every call', () => {
    const res = new SpriteResources()
    const view = createHealthBar(res, 1)

    updateHealthBar(view, 8, 10, IDENTITY)
    expect(view.hpFill.scale.x).toBeCloseTo(0.8, 10)

    // A later frame with less hp must shrink the fill further.
    updateHealthBar(view, 3, 10, IDENTITY)
    expect(view.hpFill.scale.x).toBeCloseTo(0.3, 10)
    res.dispose()
  })

  it('actually shrinks the fill width and keeps it left-anchored', () => {
    const res = new SpriteResources()
    const view = createHealthBar(res, 1)

    updateHealthBar(view, 10, 10, IDENTITY)
    view.hpBar.visible = true // force a measurable full-width baseline
    view.hpFill.scale.x = 1
    const [fullMin, fullMax] = fillExtentX(view.hpFill, view.hpBar)
    const fullWidth = fullMax - fullMin

    updateHealthBar(view, 5, 10, IDENTITY)
    const [halfMin, halfMax] = fillExtentX(view.hpFill, view.hpBar)
    const halfWidth = halfMax - halfMin

    // Half the hp -> half the visible width.
    expect(halfWidth).toBeCloseTo(fullWidth / 2, 6)
    // Left edge stays put; the bar depletes from the right (OSRS style).
    expect(halfMin).toBeCloseTo(fullMin, 6)
    expect(halfMax).toBeLessThan(fullMax)
    res.dispose()
  })

  it('keeps a visible sliver instead of vanishing at ~0 hp', () => {
    const res = new SpriteResources()
    const view = createHealthBar(res, 1)

    updateHealthBar(view, 0.0001, 1000, IDENTITY)
    expect(view.hpFill.scale.x).toBeGreaterThan(0)
    expect(view.hpFill.scale.x).toBeLessThanOrEqual(0.01)
    res.dispose()
  })
})

describe('health bar tracks live NPC hp through real combat', () => {
  /** Tick until `done` (throws after `max`), mirroring combat.test.ts. */
  function tickUntil(game: Game, done: () => boolean, max = 400): void {
    for (let i = 0; i < max; i++) {
      game.tick()
      if (done()) return
    }
    throw new Error(`condition not met within ${max} ticks`)
  }

  it('shrinks the fill as the engine drains an NPC in combat', () => {
    // Passive cow next to the spawn (2,2) so the player reaches it quickly.
    const placement: NpcPlacement = { defId: 'cow', x: 4, y: 2 }
    const game = new Game({ seed: 42, map: testMap, npcs: [placement] })
    const cow = game.npcs[0]
    const maxHp = cow.def.combat.hitpoints

    const res = new SpriteResources()
    const view = createNpcMesh(res, cow) // the exact view the renderer builds

    // Full health -> the renderer keeps the bar hidden.
    updateHealthBar(view, cow.currentHp, maxHp, IDENTITY)
    expect(view.hpBar.visible).toBe(false)

    // Fight until the cow has taken (but survived) some damage.
    game.player.attack(cow)
    tickUntil(game, () => cow.currentHp < maxHp || !cow.alive)
    expect(cow.alive).toBe(true)
    expect(cow.currentHp).toBeLessThan(maxHp)

    // The renderer's per-frame update must now show a shrunken bar.
    updateHealthBar(view, cow.currentHp, maxHp, IDENTITY)
    expect(view.hpBar.visible).toBe(true)
    expect(view.hpFill.scale.x).toBeCloseTo(cow.currentHp / maxHp, 6)
    expect(view.hpFill.scale.x).toBeLessThan(1)
    res.dispose()
  })
})
