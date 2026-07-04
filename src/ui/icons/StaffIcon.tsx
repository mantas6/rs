import { IconBase } from './IconBase'

/** Wooden staff topped with a glowing orb — the Magic skill glyph. */
export function StaffIcon() {
  return (
    <IconBase>
      <line x1="6.2" y1="14.6" x2="9.6" y2="4.6" stroke="#8b5a2b" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10.2" cy="3.2" r="2.4" fill="#3aa0d8" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
      <circle cx="9.5" cy="2.5" r="0.6" fill="rgba(255,255,255,0.6)" />
    </IconBase>
  )
}
