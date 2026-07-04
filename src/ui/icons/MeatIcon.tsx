import { IconBase } from './IconBase'

/** Cut of meat with marbling; color shows raw/cooked/burnt. */
export function MeatIcon({ color = '#a15c2f' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M3 6.4 Q3 3.6 6.6 3.6 Q13.4 3.8 13.4 8 Q13.4 12.4 8.4 12.4 Q3 12.4 3 6.4 Z"
        fill={color}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.4"
      />
      <path d="M5 6.4 Q6.4 5.2 8.2 6.2 Q10 7.2 11.4 6.4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
    </IconBase>
  )
}
