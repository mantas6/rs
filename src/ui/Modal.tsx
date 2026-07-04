import { useEffect } from 'react'
import type { ReactNode } from 'react'

/**
 * Reusable modal overlay: a dimmed full-screen backdrop centering an
 * OSRS-styled window with a title bar and a close (X) button.
 *
 * Visibility is owned by the caller and should be DERIVED from engine state
 * (e.g. rendered only while `game.bank.isOpen`), never duplicated in React
 * state. Pressing Escape, clicking the backdrop, or the X button all invoke
 * `onClose`, which must issue the engine's close command so the engine
 * stays the single source of truth for whether the interface is open.
 */
export function Modal({
  title,
  onClose,
  className,
  children,
}: {
  title: string
  onClose: () => void
  className?: string
  children: ReactNode
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-titlebar">
          <span className="modal-title">{title}</span>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
