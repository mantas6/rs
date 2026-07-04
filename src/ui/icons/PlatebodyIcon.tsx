import { IconBase } from './IconBase'

/** Platebody: armored torso with flared shoulders. */
export function PlatebodyIcon({ color = '#aab2bd' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M4.2 2.2 L6.6 3.2 Q8 4 9.4 3.2 L11.8 2.2 L14 4.8 L11.6 6.4 V12.6 Q8 14.4 4.4 12.6 V6.4 L2 4.8 Z"
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.5"
      />
      <line x1="8" y1="6" x2="8" y2="13" stroke="rgba(0,0,0,0.25)" strokeWidth="0.7" />
    </IconBase>
  )
}
