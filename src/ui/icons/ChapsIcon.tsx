import { IconBase } from './IconBase'

/** Soft leg armour (leather chaps): laced trousers with open legs. */
export function ChapsIcon({ color = '#c9a86a' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M4.6 2.6 H11.4 V4.4 Q10 6 10.4 13.6 H8.6 L8 7.6 L7.4 13.6 H5.6 Q6 6 4.6 4.4 Z"
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.5"
      />
      <rect x="4.6" y="2.6" width="6.8" height="1.3" fill="#8a6b2f" />
      <line x1="6.6" y1="4.4" x2="6.6" y2="9" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
      <line x1="9.4" y1="4.4" x2="9.4" y2="9" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
    </IconBase>
  )
}
