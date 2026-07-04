import { IconBase } from './IconBase'

/** Rock with mineral flecks; fleck color identifies the ore. */
export function OreIcon({ color = '#b87333' }: { color?: string }) {
  return (
    <IconBase>
      <path d="M8 2.8 L13.2 5.6 L12.4 12.2 H3.6 L2.8 5.6 Z" fill="#7d7468" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      <circle cx="6" cy="7" r="1.2" fill={color} />
      <circle cx="9.6" cy="8.8" r="1.2" fill={color} />
      <circle cx="7.6" cy="10.4" r="1" fill={color} />
    </IconBase>
  )
}
