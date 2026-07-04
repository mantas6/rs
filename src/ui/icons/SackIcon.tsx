import { IconBase } from './IconBase'

/** Tied sack — the generic fallback icon for unmapped items. */
export function SackIcon() {
  return (
    <IconBase>
      <path
        d="M6.2 3.8 Q5.4 2.4 6.6 2 L9.4 2 Q10.6 2.4 9.8 3.8 Q13.4 5.6 13 10.4 Q12.6 14 8 14 Q3.4 14 3 10.4 Q2.6 5.6 6.2 3.8 Z"
        fill="#b08d57"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.5"
      />
      <line x1="5.8" y1="4.2" x2="10.2" y2="4.2" stroke="#5b3a1e" strokeWidth="1" />
    </IconBase>
  )
}
