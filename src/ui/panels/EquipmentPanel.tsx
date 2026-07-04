import type { AttackStyle, Game } from '../../engine'
import { attackStylesFor, EQUIPMENT_SLOTS, getItemDef } from '../../engine'
import { ItemIcon } from '../icons/ItemIcon'
import type { MessageStore } from '../messages'

/** Human-readable label for an attack-style button. */
const STYLE_LABELS: Record<AttackStyle, string> = {
  accurate: 'accurate',
  aggressive: 'aggressive',
  defensive: 'defensive',
  controlled: 'controlled',
  ranged_accurate: 'accurate',
  ranged_rapid: 'rapid',
}

/** Worn equipment: click a filled slot to unequip; bonus totals below. */
export function EquipmentPanel({
  game,
  store,
  refresh,
}: {
  game: Game
  store: MessageStore
  refresh: () => void
}) {
  const equipment = game.player.equipment
  const bonuses = equipment.totalBonuses()
  const attackStyles = attackStylesFor(equipment)

  function unequip(slot: (typeof EQUIPMENT_SLOTS)[number]): void {
    if (!game.player.unequip(slot)) {
      store.push("You don't have enough inventory space to do that.")
    }
    refresh()
  }

  return (
    <div className="equip-panel">
      <div className="equip-list">
        {EQUIPMENT_SLOTS.map((slot) => {
          const item = equipment.get(slot)
          return (
            <button
              type="button"
              key={slot}
              className={`equip-row${item ? ' filled' : ''}`}
              disabled={!item}
              title={item ? `Unequip ${getItemDef(item.itemId).name}` : undefined}
              onClick={() => unequip(slot)}
            >
              <span className="equip-slot-name">{slot}</span>
              <span className="equip-item-name">
                {item ? (
                  <>
                    <ItemIcon itemId={item.itemId} />
                    {getItemDef(item.itemId).name}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </button>
          )
        })}
      </div>
      <div className="equip-bonuses">
        <div>
          Attack: stab {bonuses.attackStab}, slash {bonuses.attackSlash}, crush{' '}
          {bonuses.attackCrush}
        </div>
        <div>
          Defence: stab {bonuses.defenceStab}, slash {bonuses.defenceSlash}, crush{' '}
          {bonuses.defenceCrush}
        </div>
        <div>Melee strength: {bonuses.meleeStrength}</div>
        <div>
          Ranged: attack {bonuses.attackRanged}, strength {bonuses.rangedStrength}
        </div>
      </div>
      <div className="attack-styles">
        <span className="attack-styles-label">Attack style</span>
        <div className="attack-style-buttons">
          {attackStyles.map((style) => (
            <button
              type="button"
              key={style}
              className={game.player.attackStyle === style ? 'active' : ''}
              onClick={() => {
                game.player.setAttackStyle(style)
                refresh()
              }}
            >
              {STYLE_LABELS[style]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
