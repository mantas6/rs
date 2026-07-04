import { IconBase } from './IconBase'

/** Metal ingot: trapezoid bar with a top highlight. */
export function BarIcon({ color = '#b08d57' }: { color?: string }) {
  return (
    <IconBase>
      <polygon points="2.4,11 4.6,5.8 11.4,5.8 13.6,11" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      <polygon points="4.6,5.8 11.4,5.8 12.2,7.6 3.8,7.6" fill="rgba(255,255,255,0.25)" />
    </IconBase>
  )
}
