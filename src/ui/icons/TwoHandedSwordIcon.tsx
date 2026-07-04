import { IconBase } from './IconBase'

/** Two-handed sword: broad blade, wide crossguard and long grip. */
export function TwoHandedSwordIcon({ color = '#c8ccd2' }: { color?: string }) {
  return (
    <IconBase>
      <polygon points="8,0.6 9.8,3 9.8,9.2 6.2,9.2 6.2,3" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      <rect x="3.4" y="9.2" width="9.2" height="1.7" rx="0.8" fill="#8a6b2f" />
      <rect x="7.15" y="10.9" width="1.7" height="3.4" fill="#5b3a1e" />
      <circle cx="8" cy="14.8" r="1.1" fill="#8a6b2f" />
    </IconBase>
  )
}
