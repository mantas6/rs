import { IconBase } from './IconBase'

/** Kite shield with a central boss — Defence skill and shield items. */
export function ShieldIcon({ color = '#aab2bd' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M8 1.4 L13.8 3.4 V7.6 Q13.8 12.2 8 14.8 Q2.2 12.2 2.2 7.6 V3.4 Z"
        fill={color}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.6"
      />
      <circle cx="8" cy="7" r="1.6" fill="rgba(0,0,0,0.25)" />
    </IconBase>
  )
}
