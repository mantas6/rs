import { IconBase } from './IconBase'

/** Full helm: dome with cheek guards and a dark eye slit. */
export function HelmetIcon({ color = '#aab2bd' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M3.2 8.2 Q3.2 2.6 8 2.6 Q12.8 2.6 12.8 8.2 V13.2 H10.2 V9.2 H5.8 V13.2 H3.2 Z"
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.5"
      />
      <rect x="5.8" y="6.6" width="4.4" height="1.2" fill="rgba(0,0,0,0.45)" />
    </IconBase>
  )
}
