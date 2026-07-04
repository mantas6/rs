import { IconBase } from './IconBase'

/** Glove: mitten body with a splayed thumb and cuff. */
export function GlovesIcon({ color = '#c9a86a' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M5 5.2 V2.4 H6.4 V5 H7.2 V2.2 H8.6 V5 H9.4 V2.6 H10.8 V6.2 Q12.6 6.4 12.4 8.6 Q12 11 9.6 11 H6.4 Q4.4 10.6 4.4 8 V6.4 L3 5.2 Q2.6 3.8 4 3.6 Q4.8 3.8 5 5.2 Z"
        fill={color}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.5"
      />
      <rect x="5.6" y="11" width="4.4" height="2.4" rx="0.6" fill="#8a6b2f" />
    </IconBase>
  )
}
