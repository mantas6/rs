import { IconBase } from './IconBase'

/** Platelegs: belted armored trousers. */
export function PlatelegsIcon({ color = '#aab2bd' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M4.4 2.2 H11.6 V5 L10.6 13.8 H8.9 L8 7.4 L7.1 13.8 H5.4 L4.4 5 Z"
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.5"
      />
      <rect x="4.4" y="2.2" width="7.2" height="1.4" fill="rgba(0,0,0,0.3)" />
    </IconBase>
  )
}
