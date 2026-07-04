import { IconBase } from './IconBase'

/** Beamed pair of eighth notes — the music toggle icon. */
export function MusicIcon() {
  return (
    <IconBase>
      <ellipse cx="4.6" cy="12" rx="1.7" ry="1.3" fill="currentColor" />
      <ellipse cx="11.4" cy="10.6" rx="1.7" ry="1.3" fill="currentColor" />
      <line x1="6.3" y1="12" x2="6.3" y2="3.6" stroke="currentColor" strokeWidth="1.1" />
      <line x1="13.1" y1="10.6" x2="13.1" y2="2.2" stroke="currentColor" strokeWidth="1.1" />
      <polygon points="6.3,3.1 13.1,1.7 13.1,3.9 6.3,5.3" fill="currentColor" />
    </IconBase>
  )
}
