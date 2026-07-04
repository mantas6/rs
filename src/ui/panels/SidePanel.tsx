import { useState } from 'react'
import type { ReactElement } from 'react'
import type { Game } from '../../engine'
import type { AudioManager } from '../audio'
import { BackpackIcon } from '../icons/BackpackIcon'
import { BootIcon } from '../icons/BootIcon'
import { HelmetIcon } from '../icons/HelmetIcon'
import { MusicIcon } from '../icons/MusicIcon'
import { PrayerIcon } from '../icons/PrayerIcon'
import { ResetIcon } from '../icons/ResetIcon'
import { SpeakerIcon } from '../icons/SpeakerIcon'
import { StatsIcon } from '../icons/StatsIcon'
import type { MessageStore } from '../messages'
import { clearStoredSave } from '../saveStorage'
import { EquipmentPanel } from './EquipmentPanel'
import { InventoryPanel } from './InventoryPanel'
import { PrayerPanel } from './PrayerPanel'
import { SkillsPanel } from './SkillsPanel'

type Tab = 'inventory' | 'skills' | 'equipment' | 'prayer'

const TABS: readonly Tab[] = ['inventory', 'skills', 'equipment', 'prayer']

const TAB_ICONS: Record<Tab, () => ReactElement> = {
  inventory: () => <BackpackIcon />,
  skills: () => <StatsIcon />,
  equipment: () => <HelmetIcon color="currentColor" />,
  prayer: () => <PrayerIcon />,
}

/**
 * OSRS-style side panel: status row (HP orb, run toggle, audio toggles,
 * tick counter), tab strip, and the active tab's panel. The tabs stay
 * visible at all times; the bank and shop interfaces open as separate
 * modal overlays (see BankModal/ShopModal) rather than replacing the panel.
 */
export function SidePanel({
  game,
  store,
  refresh,
  audio,
}: {
  game: Game
  store: MessageStore
  refresh: () => void
  audio: AudioManager
}) {
  const [tab, setTab] = useState<Tab>('inventory')
  const skills = game.player.skills
  const hp = skills.getCurrentLevel('hitpoints')
  const maxHp = skills.getLevel('hitpoints')
  // Fraction of health left, used to fill the orb vertically (and tint it
  // green -> yellow -> red as it drains) so the orb shows health at a glance.
  const hpFraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0
  const hpColor = hpFraction > 0.5 ? '#3fbf4a' : hpFraction > 0.25 ? '#e2a400' : '#d1493c'

  return (
    <aside className="side-panel">
      <div className="status-row">
        <div className="hp-orb" title={`Hitpoints: ${hp}/${maxHp}`}>
          <div
            className="hp-orb-fill"
            style={{ height: `${hpFraction * 100}%`, background: hpColor }}
          />
          <span className="hp-orb-value">{hp}</span>
          <span className="hp-orb-max">/{maxHp}</span>
        </div>
        <button
          type="button"
          className={`run-toggle${game.player.running ? ' active' : ''}`}
          title={game.player.running ? 'Run: on' : 'Run: off'}
          onClick={() => {
            game.player.setRun(!game.player.running)
            refresh()
          }}
        >
          <BootIcon color="currentColor" />
          Run
        </button>
        <button
          type="button"
          className={`run-toggle audio-toggle${audio.musicEnabled ? ' active' : ''}`}
          title={audio.musicEnabled ? 'Music: on' : 'Music: off'}
          aria-label={audio.musicEnabled ? 'Music: on' : 'Music: off'}
          onClick={() => {
            audio.setMusicEnabled(!audio.musicEnabled)
            refresh()
          }}
        >
          <MusicIcon />
        </button>
        <button
          type="button"
          className={`run-toggle audio-toggle${audio.sfxEnabled ? ' active' : ''}`}
          title={audio.sfxEnabled ? 'Sound effects: on' : 'Sound effects: off'}
          aria-label={audio.sfxEnabled ? 'Sound effects: on' : 'Sound effects: off'}
          onClick={() => {
            audio.setSfxEnabled(!audio.sfxEnabled)
            if (audio.sfxEnabled) audio.play('click')
            refresh()
          }}
        >
          <SpeakerIcon />
        </button>
        <button
          type="button"
          className="run-toggle audio-toggle"
          title="Delete the save and start a fresh game"
          aria-label="New game"
          onClick={() => {
            if (!window.confirm('Delete your save and start a new game?')) return
            clearStoredSave()
            window.location.reload()
          }}
        >
          <ResetIcon />
        </button>
        <span className="tick-counter">Tick {game.tickCount}</span>
      </div>

      <div className="tab-strip">
        {TABS.map((name) => (
          <button
            type="button"
            key={name}
            className={tab === name ? 'active' : ''}
            title={name.charAt(0).toUpperCase() + name.slice(1)}
            onClick={() => {
              audio.play('click')
              setTab(name)
            }}
          >
            {TAB_ICONS[name]()}
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'inventory' && <InventoryPanel game={game} store={store} refresh={refresh} />}
      {tab === 'skills' && <SkillsPanel game={game} />}
      {tab === 'equipment' && <EquipmentPanel game={game} store={store} refresh={refresh} />}
      {tab === 'prayer' && <PrayerPanel game={game} refresh={refresh} />}
    </aside>
  )
}
