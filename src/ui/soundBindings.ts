// Engine-event-to-sound wiring, mirroring messages.ts: subscribe to the
// EventBus and translate gameplay events into AudioManager.play() calls.
import type { Game } from '../engine'
import type { AudioManager, SfxName } from './audio'

const GATHER_SFX: Record<string, SfxName> = {
  woodcutting: 'chop',
  mining: 'mine',
  fishing: 'splash',
}

/**
 * Subscribe the audio manager to engine events. Returns an
 * unsubscribe-all cleanup function.
 */
export function connectGameSounds(game: Game, audio: AudioManager): () => void {
  const unsubscribes = [
    // Tool sound plays on every swing (not just successful gathers) so that
    // chopping/mining/fishing is audible while working, like OSRS.
    game.events.on('gatherSwing', ({ skill }) => {
      audio.play(GATHER_SFX[skill] ?? 'click')
    }),
    game.events.on('damageDealt', ({ damage }) => {
      audio.play(damage > 0 ? 'hit' : 'miss')
    }),
    game.events.on('npcDied', () => audio.play('death')),
    game.events.on('playerDied', () => audio.play('death', { volume: 1 })),
    game.events.on('levelUp', () => audio.play('levelup')),
    game.events.on('itemEaten', () => audio.play('eat')),
    game.events.on('fireLit', () => audio.play('fire')),
    game.events.on('itemCooked', () => audio.play('cook')),
    game.events.on('itemDropped', () => audio.play('drop')),
    game.events.on('bonesBuried', () => audio.play('drop')),
    game.events.on('groundItemRemoved', ({ reason }) => {
      if (reason === 'picked_up') audio.play('pickup')
    }),
    game.events.on('oreSmelted', () => audio.play('smith')),
    game.events.on('equipmentChanged', () => audio.play('equip')),
    game.events.on('bankOpened', () => audio.play('bank')),
    game.events.on('bankClosed', () => audio.play('bank')),
    game.events.on('shopOpened', () => audio.play('bank')),
    game.events.on('shopClosed', () => audio.play('bank')),
    game.events.on('itemBought', () => audio.play('pickup')),
    game.events.on('itemSold', () => audio.play('pickup')),
  ]
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe()
  }
}
