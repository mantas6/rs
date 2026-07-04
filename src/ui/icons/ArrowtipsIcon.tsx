import { IconBase } from './IconBase'

/** A small heap of metal arrow heads. */
export function ArrowtipsIcon({ color = '#b08d57' }: { color?: string }) {
  return (
    <IconBase>
      <polygon points="4,10 6,4 8,10" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      <polygon points="8,13 10,7 12,13" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      <polygon points="9,6 11,2 13,6" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
    </IconBase>
  )
}
