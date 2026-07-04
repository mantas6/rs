import type { ReactNode } from 'react'

/**
 * Shared wrapper for all inline SVG icons: a 16x16 viewBox that scales to
 * whatever size CSS assigns via the `.icon` class (see app.css). Icons are
 * always decorative; the enclosing control carries the accessible name
 * (title/aria-label), so the svg is hidden from assistive tech.
 */
export function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className="icon" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}
