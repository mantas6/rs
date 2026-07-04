// Save/load: serialize -> deserialize round-trips and, critically,
// determinism — a loaded game must continue exactly like the original
// (same Rng state, same tick counter, same world state).
import { describe, expect, it } from 'vitest'
import { type Game, type GameSave, SAVE_FORMAT_VERSION } from '../core/game'
import type { Vec2 } from '../world/vec2'
import { isCompatibleSave, loadGame } from './loadGame'
import { createNewGame } from './newGame'

const SEED = 42

/** Build a game with plenty of mutated state to exercise every save field. */
function buildRichGame(): Game {
  const game = createNewGame(SEED)
  const { player } = game

  // Inventory, equipment, skills (including a drain, i.e. lost hitpoints).
  player.inventory.add('coins', 150)
  player.inventory.add('logs', 3)
  player.inventory.add('tinderbox', 1)
  player.inventory.add('bronze_sword', 1)
  player.inventory.add('shrimps', 2)
  expect(player.equip('bronze_sword')).toBe(true)
  player.skills.addXp('woodcutting', 2500)
  player.skills.boost('hitpoints', -3)
  player.setRun(true)
  player.setAttackStyle('aggressive')

  // Bank contents.
  game.bank.open()
  expect(game.bank.deposit('coins', 50)).toBe(50)
  game.bank.close()

  // World state: a depleted node, a hurt NPC, a ground item, and a fire.
  game.world.nodes[0].deplete(game.tickCount + 40)
  game.npcs[0].takeDamage(2)
  const { x, y } = player.position
  game.groundItems.add('bones', 1, x, y, game.tickCount + 200)
  game.fires.light(x, y, game.tickCount + 30)
  return game
}

/** First walkable tile other than `from` within Chebyshev 3 (test walks). */
function nearbyWalkable(game: Game, from: Vec2): Vec2 {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = from.x + dx
      const y = from.y + dy
      if ((dx !== 0 || dy !== 0) && game.world.isWalkable(x, y)) return { x, y }
    }
  }
  throw new Error('no walkable tile near player')
}

describe('save/load', () => {
  it('serialize -> JSON -> loadGame round-trips the full state', () => {
    const game = buildRichGame()
    for (let i = 0; i < 25; i++) game.tick()

    const save = game.serialize()
    expect(save.version).toBe(SAVE_FORMAT_VERSION)

    // Saves must survive a JSON round-trip (that is how the UI stores them).
    const loaded = loadGame(JSON.parse(JSON.stringify(save)))
    expect(loaded).not.toBeNull()
    const restored = loaded as Game

    expect(restored.serialize()).toEqual(save)
    expect(restored.tickCount).toBe(game.tickCount)
    expect(restored.player.position).toEqual(game.player.position)
    expect(restored.player.running).toBe(true)
    expect(restored.player.attackStyle).toBe('aggressive')
    expect(restored.player.skills.getXp('woodcutting')).toBe(2500)
    expect(restored.player.skills.getCurrentLevel('hitpoints')).toBe(
      game.player.skills.getCurrentLevel('hitpoints'),
    )
    expect(restored.player.inventory.count('coins')).toBe(100)
    expect(restored.player.equipment.get('weapon')?.itemId).toBe('bronze_sword')
    expect(restored.bank.count('coins')).toBe(50)
    expect(restored.world.nodes[0].depleted).toBe(game.world.nodes[0].depleted)
    expect(restored.npcs[0].currentHp).toBe(game.npcs[0].currentHp)
    expect(restored.groundItems.items).toEqual(game.groundItems.items)
    expect(restored.fires.serialize()).toEqual(game.fires.serialize())
  })

  it('loads the player idle: in-progress actions and movement are dropped', () => {
    const game = buildRichGame()
    const target = nearbyWalkable(game, game.player.position)
    expect(game.player.walkTo(target.x, target.y)).toBe(true)
    expect(game.player.isMoving).toBe(true)

    const loaded = loadGame(game.serialize()) as Game
    expect(loaded.player.isMoving).toBe(false)
    expect(loaded.player.action).toBeNull()
  })

  it('a loaded game continues exactly like the original (Rng state restored)', () => {
    const original = buildRichGame()
    for (let i = 0; i < 40; i++) original.tick()
    // The save drops in-flight actions/paths and NPC targets; make the
    // original match that so both games face identical conditions.
    original.player.stop()
    original.player.setAction(null)
    for (const npc of original.npcs) npc.setTarget(null)

    const loaded = loadGame(JSON.parse(JSON.stringify(original.serialize())))
    expect(loaded).not.toBeNull()
    const restored = loaded as Game

    // Same subsequent commands on both games...
    const target = nearbyWalkable(original, original.player.position)
    expect(original.player.walkTo(target.x, target.y)).toBe(true)
    expect(restored.player.walkTo(target.x, target.y)).toBe(true)

    // ...produce identical evolution, tick by tick (NPC wandering, combat
    // rolls, respawns all flow from the restored Rng state).
    for (let i = 0; i < 100; i++) {
      original.tick()
      restored.tick()
      expect(restored.player.position).toEqual(original.player.position)
      expect(restored.npcs.map((n) => n.serialize())).toEqual(
        original.npcs.map((n) => n.serialize()),
      )
    }
    expect(restored.serialize()).toEqual(original.serialize())
  })

  it('rejects incompatible and corrupt saves', () => {
    expect(loadGame(null)).toBeNull()
    expect(loadGame(undefined)).toBeNull()
    expect(loadGame('junk')).toBeNull()
    expect(loadGame({})).toBeNull()
    expect(loadGame({ version: SAVE_FORMAT_VERSION + 1, seed: SEED })).toBeNull()
    expect(isCompatibleSave({ version: SAVE_FORMAT_VERSION, seed: SEED })).toBe(true)

    const save = createNewGame(SEED).serialize()
    expect(isCompatibleSave(save)).toBe(true)

    const unknownItem = JSON.parse(JSON.stringify(save)) as GameSave
    unknownItem.player.inventory[0] = { itemId: 'no_such_item', quantity: 1 }
    expect(loadGame(unknownItem)).toBeNull()

    const badTile = JSON.parse(JSON.stringify(save)) as GameSave
    badTile.player.x = -5
    expect(loadGame(badTile)).toBeNull()

    const wrongWorld = JSON.parse(JSON.stringify(save)) as GameSave
    wrongWorld.npcs = []
    expect(loadGame(wrongWorld)).toBeNull()
  })
})

describe('save migration (v1 -> v2)', () => {
  /** A v1 save: the current save minus `patches`, tagged version 1. */
  function buildV1Save(): Record<string, unknown> {
    const current = JSON.parse(JSON.stringify(createNewGame(SEED).serialize())) as Record<
      string,
      unknown
    >
    delete current.patches
    current.version = 1
    return current
  }

  it('treats a v1 save (no patches) as compatible', () => {
    const v1 = buildV1Save()
    expect('patches' in v1).toBe(false)
    expect(isCompatibleSave(v1)).toBe(true)
  })

  it('loads a v1 save via migration into a playable game with empty patches', () => {
    const loaded = loadGame(buildV1Save())
    expect(loaded).not.toBeNull()
    const game = loaded as Game

    // The migrated game has its real Lumbridge patches, all unplanted.
    expect(game.world.patches.length).toBeGreaterThan(0)
    for (const patch of game.world.patches) {
      expect(patch.isPlanted).toBe(false)
    }
    // ...and it is playable: ticking does not throw and serializes at v2.
    for (let i = 0; i < 5; i++) game.tick()
    expect(game.serialize().version).toBe(SAVE_FORMAT_VERSION)
  })

  it('round-trips planted-patch state across a v2 save/load', () => {
    const game = createNewGame(SEED)
    const patch = game.world.patches[0]
    patch.plant('potato_seed')
    // Tick partway so the crop is mid-growth (not yet fully grown).
    game.tick()
    game.tick()
    game.tick()
    expect(patch.isPlanted).toBe(true)
    expect(patch.isGrown()).toBe(false)

    const loaded = loadGame(JSON.parse(JSON.stringify(game.serialize())))
    expect(loaded).not.toBeNull()
    const restored = loaded as Game
    const restoredPatch = restored.world.patches[0]

    expect(restoredPatch.plantedSeedId).toBe('potato_seed')
    expect(restoredPatch.stage).toBe(patch.stage)
    expect(restoredPatch.ticksIntoStage).toBe(patch.ticksIntoStage)
    // Other patches stay empty.
    expect(restored.world.patches[1].isPlanted).toBe(false)
  })
})
