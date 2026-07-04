import { IconBase } from './IconBase'

/** Bow with a nocked arrow — the Ranged skill glyph. */
export function BowIcon() {
  return (
    <IconBase>
      <path d="M4.6 1.8 Q13.2 8 4.6 14.2" fill="none" stroke="#8b5a2b" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4.6" y1="1.8" x2="4.6" y2="14.2" stroke="#d8cfae" strokeWidth="0.8" />
      <line x1="4.6" y1="8" x2="12.6" y2="8" stroke="#9c8d72" strokeWidth="1.1" />
      <polygon points="14.6,8 11.9,6.7 11.9,9.3" fill="#c8ccd2" />
    </IconBase>
  )
}
