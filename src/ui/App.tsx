import { useEffect, useMemo } from 'react'
import './app.css'
import { GameCanvas } from './GameCanvas'
import { MessageLog } from './MessageLog'
import { connectGameMessages, MessageStore } from './messages'
import { SidePanel } from './panels/SidePanel'
import { useGame } from './useGame'

export function App() {
  const { game, version, refresh } = useGame()
  const store = useMemo(() => new MessageStore(), [])

  useEffect(() => connectGameMessages(game, store), [game, store])

  return (
    <div className="app">
      <div className="app-main">
        <GameCanvas game={game} version={version} store={store} refresh={refresh} />
        <MessageLog store={store} />
      </div>
      <SidePanel game={game} store={store} refresh={refresh} />
    </div>
  )
}
