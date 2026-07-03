import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { MessageStore } from './messages'

/** Scrolling OSRS-style chat/message box under the canvas. */
export function MessageLog({ store }: { store: MessageStore }) {
  const messages = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  return (
    <div className="message-log" ref={listRef}>
      {messages.map((message) => (
        <div key={message.id} className="message-log-line">
          {message.text}
        </div>
      ))}
    </div>
  )
}
