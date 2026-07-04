import { PRAYER_LIST } from '../../content/prayers'
import type { PrayerDef } from '../../content/types'
import type { Game } from '../../engine'
import { PrayerIcon } from '../icons/PrayerIcon'

/** Human-readable summary of a prayer's stat boosts (e.g. "+10% Strength"). */
function effectText(def: PrayerDef): string {
  const parts: string[] = []
  if (def.attackBonus) parts.push(`+${Math.round(def.attackBonus * 100)}% Attack`)
  if (def.strengthBonus) parts.push(`+${Math.round(def.strengthBonus * 100)}% Strength`)
  if (def.defenceBonus) parts.push(`+${Math.round(def.defenceBonus * 100)}% Defence`)
  return parts.join(', ')
}

/**
 * Prayer book: current prayer points vs max, then every prayer as a toggle
 * button. Active prayers are highlighted; prayers above the player's base
 * Prayer level are disabled. Clicking calls the engine command
 * `player.togglePrayer` — this panel contains no game logic.
 */
export function PrayerPanel({ game, refresh }: { game: Game; refresh: () => void }) {
  const skills = game.player.skills
  const prayers = game.player.prayers
  const points = skills.getCurrentLevel('prayer')
  const maxPoints = skills.getLevel('prayer')

  return (
    <div className="prayer-panel">
      <div className="prayer-points" title={`Prayer points: ${points}/${maxPoints}`}>
        <PrayerIcon />
        <span className="prayer-points-value">
          {points}/{maxPoints}
        </span>
      </div>
      <div className="prayer-list">
        {PRAYER_LIST.map((def) => {
          const active = prayers.isActive(def.id)
          const locked = maxPoints < def.levelRequired
          return (
            <button
              type="button"
              key={def.id}
              className={`prayer-row${active ? ' active' : ''}${locked ? ' locked' : ''}`}
              disabled={locked}
              title={
                locked
                  ? `Requires Prayer level ${def.levelRequired}`
                  : `${def.examine} (drains prayer while active)`
              }
              onClick={() => {
                game.player.togglePrayer(def.id)
                refresh()
              }}
            >
              <span className="prayer-row-head">
                <PrayerIcon />
                <span className="prayer-name">{def.name}</span>
                <span className="prayer-level">Lv {def.levelRequired}</span>
              </span>
              <span className="prayer-effect">{effectText(def)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
