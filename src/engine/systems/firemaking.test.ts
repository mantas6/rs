import { describe, expect, it } from 'vitest'
import { testMap } from '../../content/maps'
import { firemakingDefs } from '../../content/recipes'
import { Game } from '../core/game'
import type { ActionFailReason } from './gathering'

// testMap spawn is (2, 2); row 2 is fully walkable from x=1 to x=14.
function makeGame(seed = 42): Game {
  return new Game({ seed, map: testMap })
}

function collectFailures(game: Game): ActionFailReason[] {
  const reasons: ActionFailReason[] = []
  game.events.on('actionFailed', ({ reason }) => reasons.push(reason))
  return reasons
}

/** Tick until `done` returns true (throws after `max` ticks). */
function tickUntil(game: Game, done: () => boolean, max = 200): void {
  for (let i = 0; i < max; i++) {
    game.tick()
    if (done()) return
  }
  throw new Error(`condition not met within ${max} ticks`)
}

describe('firemaking: validation', () => {
  it('emits missing_tool without a tinderbox', () => {
    const game = makeGame()
    game.player.inventory.add('logs')
    const failures = collectFailures(game)

    expect(game.player.lightFire('logs')).toBe(false)
    expect(failures).toEqual(['missing_tool'])
    expect(game.player.action).toBeNull()
  })

  it('emits missing_ingredient without logs', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    const failures = collectFailures(game)

    expect(game.player.lightFire('logs')).toBe(false)
    expect(failures).toEqual(['missing_ingredient'])
  })

  it('emits level_too_low for oak logs at firemaking 1', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    game.player.inventory.add('oak_logs')
    const failures = collectFailures(game)

    expect(game.player.lightFire('oak_logs')).toBe(false)
    expect(failures).toEqual(['level_too_low'])
  })

  it('throws on unknown logs item ids', () => {
    const game = makeGame()
    expect(() => game.player.lightFire('bronze_sword')).toThrow(/Unknown firemaking logs id/)
  })
})

describe('firemaking: lighting a fire', () => {
  it('consumes logs, grants xp, creates a fire and steps west', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    game.player.inventory.add('logs')
    const lit: Array<{ x: number; y: number; expiresAtTick: number }> = []
    game.events.on('fireLit', (e) => lit.push(e))

    expect(game.player.lightFire('logs')).toBe(true)
    expect(game.player.action).not.toBeNull()
    tickUntil(game, () => game.fires.fires.length > 0)

    expect(game.player.inventory.count('logs')).toBe(0)
    expect(game.player.inventory.count('tinderbox')).toBe(1) // not consumed
    expect(game.player.skills.getXp('firemaking')).toBe(firemakingDefs.logs.xp)
    expect(lit).toEqual([
      { x: 2, y: 2, expiresAtTick: game.tickCount + firemakingDefs.logs.burnTicks },
    ])
    expect(game.fires.fireAt(2, 2)).not.toBeNull()
    expect(game.player.position).toEqual({ x: 1, y: 2 }) // stepped west
    expect(game.player.action).toBeNull()
  })

  it('steps east when the west tile is blocked', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    game.player.inventory.add('logs')
    // Walk to (1, 2): its west neighbor (0, 2) is the outer wall.
    expect(game.player.walkTo(1, 2)).toBe(true)
    game.tick()
    expect(game.player.position).toEqual({ x: 1, y: 2 })

    game.player.lightFire('logs')
    tickUntil(game, () => game.fires.fires.length > 0)

    expect(game.fires.fireAt(1, 2)).not.toBeNull()
    expect(game.player.position).toEqual({ x: 2, y: 2 }) // stepped east instead
  })

  it('fires do not block movement', () => {
    const game = makeGame()
    game.fires.light(3, 2, 10_000)
    expect(game.world.isWalkable(3, 2)).toBe(true)
    expect(game.player.walkTo(3, 2)).toBe(true)
  })

  it('cannot light on a tile that already has a fire', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    game.player.inventory.add('logs')
    game.fires.light(2, 2, 10_000) // fire on the player's tile
    const failures = collectFailures(game)

    expect(game.player.lightFire('logs')).toBe(false)
    expect(failures).toEqual(['cannot_light_here'])
    expect(game.player.inventory.count('logs')).toBe(1)
  })
})

describe('firemaking: fire expiry', () => {
  it('the fire expires after burnTicks and emits fireExpired', () => {
    const game = makeGame()
    game.player.inventory.add('tinderbox')
    game.player.inventory.add('logs')
    const expired: Array<{ x: number; y: number }> = []
    game.events.on('fireExpired', (e) => expired.push(e))

    game.player.lightFire('logs')
    tickUntil(game, () => game.fires.fires.length > 0)
    const fire = game.fires.fireAt(2, 2)!

    // Still burning on the tick before expiry.
    while (game.tickCount < fire.expiresAtTick - 1) game.tick()
    expect(fire.expired).toBe(false)
    expect(expired).toEqual([])

    game.tick() // tickCount reaches expiresAtTick
    expect(fire.expired).toBe(true)
    expect(game.fires.fires).toEqual([])
    expect(game.fires.fireAt(2, 2)).toBeNull()
    expect(expired).toEqual([{ x: 2, y: 2 }])
  })
})

describe('firemaking: determinism', () => {
  it('same seed + same commands light the fire on the same tick', () => {
    const run = (): { litAtTick: number; xp: number } => {
      const game = makeGame(1234)
      game.player.inventory.add('tinderbox')
      game.player.inventory.add('logs')
      game.player.lightFire('logs')
      tickUntil(game, () => game.fires.fires.length > 0)
      return { litAtTick: game.tickCount, xp: game.player.skills.getXp('firemaking') }
    }

    const a = run()
    const b = run()
    expect(a).toEqual(b)
    expect(a.xp).toBe(40)
  })
})
