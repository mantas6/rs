import { useCallback, useEffect, useState } from 'react'
import { Game, TICK_MS } from '../engine'
import { createDemoGame } from './createDemoGame'
import { writeStoredSave } from './saveStorage'

/** Fallback seed when the URL has no (or an invalid) ?seed= parameter. */
export const DEFAULT_SEED = 42

/** Autosave every this many ticks (~10s at 600ms ticks). */
export const AUTOSAVE_INTERVAL_TICKS = 17

/** Seed from the ?seed= URL parameter, or DEFAULT_SEED. */
function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed')
  const parsed = raw === null ? NaN : Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : DEFAULT_SEED
}

/**
 * Owns the single Game instance and drives it in real time.
 *
 * Rendering strategy: a plain `version` counter bumped on every engine
 * `tick` plus the instant-feedback events (inventory/equipment/bank/xp
 * changes fired by UI commands between ticks). Components take `version`
 * as a prop, so React re-renders and the canvas redraws once per tick —
 * at 600ms ticks a rAF loop buys nothing, so we deliberately skip it.
 * `refresh()` forces a bump after commands that emit no event (e.g.
 * setRun, setAttackStyle, walkTo).
 *
 * Persistence: the game is autoloaded from localStorage in createDemoGame;
 * here it autosaves every AUTOSAVE_INTERVAL_TICKS ticks, on page unload,
 * and whenever the tab is hidden (game.serialize() is a cheap plain-object
 * snapshot). The engine never touches storage itself.
 */
export function useGame(): { game: Game; version: number; refresh: () => void } {
  // Lazy useState (not useMemo) so the game is created exactly once per
  // mounted component even across StrictMode double-invocations.
  const [game] = useState(() => createDemoGame(seedFromUrl()))
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    const events = ['tick', 'inventoryChanged', 'equipmentChanged', 'bankChanged', 'bankOpened', 'bankClosed', 'shopOpened', 'shopClosed', 'itemBought', 'xpGained'] as const
    const unsubscribes = events.map((event) => game.events.on(event, refresh))
    const interval = setInterval(() => game.tick(), TICK_MS)
    return () => {
      clearInterval(interval)
      for (const unsubscribe of unsubscribes) unsubscribe()
    }
  }, [game, refresh])

  // Autosave: periodically (tick-driven), on unload, and when hidden.
  useEffect(() => {
    const save = () => writeStoredSave(game.serialize())
    const unsubscribe = game.events.on('tick', ({ tick }) => {
      if (tick % AUTOSAVE_INTERVAL_TICKS === 0) save()
    })
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') save()
    }
    window.addEventListener('beforeunload', save)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      unsubscribe()
      window.removeEventListener('beforeunload', save)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      save() // don't lose progress across remounts
    }
  }, [game])

  return { game, version, refresh }
}
