import { IconBase } from './IconBase'

/** Scimitar: curved blade sweeping up to the tip, short dark hilt. */
export function ScimitarIcon({ color = '#c8ccd2' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M4 12.5 Q11 11.5 13 2.8 Q13.8 9.5 8.2 13 Q6 14 4 13.6 Z"
        fill={color}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.4"
      />
      <line x1="2.6" y1="14.6" x2="4.6" y2="12.6" stroke="#5b3a1e" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  )
}
