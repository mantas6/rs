import { IconBase } from './IconBase'

/** Glass vial of green liquid — the Herblore skill glyph. */
export function PotionIcon() {
  return (
    <IconBase>
      <path
        d="M6.8 2.6 H9.2 V5.4 L11.9 10.4 Q12.9 13.4 9.7 13.7 H6.3 Q3.1 13.4 4.1 10.4 L6.8 5.4 Z"
        fill="#c3d7dd"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.4"
      />
      <path d="M5.1 8.6 H10.9 L11.9 10.4 Q12.9 13.4 9.7 13.7 H6.3 Q3.1 13.4 4.1 10.4 Z" fill="#3faf5a" />
      <rect x="6.3" y="1.4" width="3.4" height="1.2" fill="#8a6b2f" />
    </IconBase>
  )
}
