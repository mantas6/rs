import { IconBase } from './IconBase'

/** Whole fish: body, tail and eye; color shows raw/cooked/burnt. */
export function FishIcon({ color = '#7fa8c0' }: { color?: string }) {
  return (
    <IconBase>
      <ellipse cx="6.8" cy="8" rx="4.4" ry="2.7" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      <polygon points="10.6,8 14.4,5.4 14.4,10.6" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      <circle cx="4.4" cy="7.3" r="0.6" fill="#14100a" />
    </IconBase>
  )
}
