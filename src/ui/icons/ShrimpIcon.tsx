import { IconBase } from './IconBase'

/** Curled shrimp with antennae; color shows raw/cooked/burnt. */
export function ShrimpIcon({ color = '#ef8f5a' }: { color?: string }) {
  return (
    <IconBase>
      <line x1="11.8" y1="3.4" x2="14" y2="1.8" stroke={color} strokeWidth="0.7" />
      <line x1="11" y1="3" x2="12.4" y2="1.2" stroke={color} strokeWidth="0.7" />
      <path
        d="M11.6 3.4 Q14.8 6.6 12.4 10.2 Q10 13.6 5.4 12.8 L6.2 10.9 Q9.4 11.4 10.8 8.9 Q12.2 6.4 10.2 4.6 Z"
        fill={color}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.4"
      />
      <circle cx="11.2" cy="4.6" r="0.5" fill="#14100a" />
    </IconBase>
  )
}
