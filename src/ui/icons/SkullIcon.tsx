import { IconBase } from './IconBase'

/** Skull — the Slayer skill glyph. */
export function SkullIcon() {
  return (
    <IconBase>
      <path
        d="M8 1.8 Q12.8 1.8 12.8 6.6 Q12.8 9 11.2 10 V12.4 H4.8 V10 Q3.2 9 3.2 6.6 Q3.2 1.8 8 1.8 Z"
        fill="#ece5d3"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="0.4"
      />
      <circle cx="6" cy="6.6" r="1.25" fill="#14100a" />
      <circle cx="10" cy="6.6" r="1.25" fill="#14100a" />
      <polygon points="8,8.2 7.2,9.6 8.8,9.6" fill="#14100a" />
      <line x1="6.4" y1="10.6" x2="6.4" y2="12.2" stroke="#14100a" strokeWidth="0.6" />
      <line x1="8" y1="10.6" x2="8" y2="12.2" stroke="#14100a" strokeWidth="0.6" />
      <line x1="9.6" y1="10.6" x2="9.6" y2="12.2" stroke="#14100a" strokeWidth="0.6" />
    </IconBase>
  )
}
