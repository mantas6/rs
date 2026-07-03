import { useState } from 'react'
import type { Game } from '../../engine'
import type { AudioManager } from '../audio'
import type { MessageStore } from '../messages'
import { BankPanel } from './BankPanel'
import { EquipmentPanel } from './EquipmentPanel'
import { InventoryPanel } from './InventoryPanel'
import { SkillsPanel } from './SkillsPanel'

type Tab = 'inventory' | 'skills' | 'equipment'

const TABS: readonly Tab[] = ['inventory', 'skills', 'equipment']

/**
 * OSRS-style side panel: status row (HP orb, run toggle, audio toggles,
 * tick counter), tab strip, and the active tab's panel. While the bank is
 * open the bank interface replaces the tabbed panel.
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

  return (
    <aside className="side-panel">
      <div className="status-row">
        <div className="hp-orb" title={`Hitpoints: ${hp}/${maxHp}`}>
          <span className="hp-orb-value">{hp}</span>
          <span className="hp-orb-max">/{maxHp}</span>
        </div>
        <button
          type="button"
          className={`run-toggle${game.player.running ? ' active' : ''}`}
          onClick={() => {
            game.player.setRun(!game.player.running)
            refresh()
          }}
        >
          {game.player.running ? 'Run: on' : 'Run: off'}
        </button>
        <button
          type="button"
          className={`run-toggle audio-toggle${audio.musicEnabled ? ' active' : ''}`}
          title={audio.musicEnabled ? 'Music: on' : 'Music: off'}
          onClick={() => {
            audio.setMusicEnabled(!audio.musicEnabled)
            refresh()
          }}
        >
          Music
        </button>
        <button
          type="button"
          className={`run-toggle audio-toggle${audio.sfxEnabled ? ' active' : ''}`}
          title={audio.sfxEnabled ? 'Sound effects: on' : 'Sound effects: off'}
          onClick={() => {
            audio.setSfxEnabled(!audio.sfxEnabled)
            if (audio.sfxEnabled) audio.play('click')
            refresh()
          }}
        >
          Sfx
        </button>
        <span className="tick-counter">Tick {game.tickCount}</span>
      </div>

      {game.bank.isOpen ? (
        <BankPanel game={game} store={store} refresh={refresh} />
      ) : (
        <>
          <div className="tab-strip">
            {TABS.map((name) => (
              <button
                type="button"
                key={name}
                className={tab === name ? 'active' : ''}
                onClick={() => {
                  audio.play('click')
                  setTab(name)
                }}
              >
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </button>
            ))}
          </div>
          {tab === 'inventory' && <InventoryPanel game={game} store={store} refresh={refresh} />}
          {tab === 'skills' && <SkillsPanel game={game} />}
          {tab === 'equipment' && <EquipmentPanel game={game} store={store} refresh={refresh} />}
        </>
      )}
    </aside>
  )
}
