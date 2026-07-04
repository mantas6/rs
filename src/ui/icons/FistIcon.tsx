import { IconBase } from './IconBase'

/** Clenched fist — the Strength skill glyph. */
export function FistIcon() {
  return (
    <IconBase>
      <ellipse cx="3.6" cy="9.6" rx="1.4" ry="2" fill="#d9a066" />
      <path
        d="M3.4 7.2 Q3.4 5 5.6 5 H11 Q12.8 5 12.8 7 V9.8 Q12.8 12.4 9.8 12.4 H6.4 Q3.4 12.4 3.4 9.8 Z"
        fill="#d9a066"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.5"
      />
      <line x1="6.4" y1="5" x2="6.4" y2="8" stroke="rgba(0,0,0,0.3)" strokeWidth="0.7" />
      <line x1="8.5" y1="5" x2="8.5" y2="8" stroke="rgba(0,0,0,0.3)" strokeWidth="0.7" />
      <line x1="10.6" y1="5" x2="10.6" y2="8" stroke="rgba(0,0,0,0.3)" strokeWidth="0.7" />
    </IconBase>
  )
}
