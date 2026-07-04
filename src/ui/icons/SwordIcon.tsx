import { IconBase } from './IconBase'

/** Straight sword: tapered blade, crossguard, grip and pommel. */
export function SwordIcon({ color = '#c8ccd2' }: { color?: string }) {
  return (
    <IconBase>
      <polygon points="8,0.8 9.4,2.4 9.4,9.6 6.6,9.6 6.6,2.4" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      <rect x="4.6" y="9.6" width="6.8" height="1.5" rx="0.7" fill="#8a6b2f" />
      <rect x="7.25" y="11.1" width="1.5" height="2.6" fill="#5b3a1e" />
      <circle cx="8" cy="14.3" r="1" fill="#8a6b2f" />
    </IconBase>
  )
}
