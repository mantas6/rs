import { useCallback, useEffect, useState } from 'react'
import { Game, TICK_MS } from '../engine'
import { createDemoGame } from './createDemoGame'

/** Fallback seed when the URL has no (or an invalid) ?seed= parameter. */
export const DEFAULT_SEED = 42

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
 */
export function useGame(): { game: Game; version: number; refresh: () => void } {
  // Lazy useState (not useMemo) so the game is created exactly once per
  // mounted component even across StrictMode double-invocations.
  const [game] = useState(() => createDemoGame(seedFromUrl()))
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    const events = ['tick', 'inventoryChanged', 'equipmentChanged', 'bankChanged', 'bankOpened', 'bankClosed', 'xpGained'] as const
    const unsubscribes = events.map((event) => game.events.on(event, refresh))
    const interval = setInterval(() => game.tick(), TICK_MS)
    return () => {
      clearInterval(interval)
      for (const unsubscribe of unsubscribes) unsubscribe()
    }
  }, [game, refresh])

  return { game, version, refresh }
}
