import { useEffect, useMemo } from 'react'
import './app.css'
import { AudioManager } from './audio'
import { GameCanvas } from './GameCanvas'
import { MessageLog } from './MessageLog'
import { connectGameMessages, MessageStore } from './messages'
import { BankModal } from './panels/BankModal'
import { ShopModal } from './panels/ShopModal'
import { SidePanel } from './panels/SidePanel'
import { connectGameSounds } from './soundBindings'
import { useGame } from './useGame'

export function App() {
  const { game, version, refresh } = useGame()
  const store = useMemo(() => new MessageStore(), [])
  const audio = useMemo(() => new AudioManager(), [])

  useEffect(() => connectGameMessages(game, store), [game, store])

  useEffect(() => {
    audio.init()
    const disconnect = connectGameSounds(game, audio)
    return () => {
      disconnect()
      audio.dispose()
    }
  }, [game, audio])

  return (
    <div className="app">
      <div className="app-main">
        <header className="app-header">RuneSlop</header>
        <GameCanvas game={game} version={version} store={store} refresh={refresh} />
        <MessageLog store={store} />
      </div>
      <SidePanel game={game} store={store} refresh={refresh} audio={audio} />
      {game.bank.isOpen && <BankModal game={game} store={store} refresh={refresh} />}
      {game.shop.isOpen && <ShopModal game={game} store={store} refresh={refresh} />}
    </div>
  )
}
