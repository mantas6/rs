import { IconBase } from './IconBase'

/** Full beer: tankard of amber ale with a frothy head and handle. */
export function BeerIcon() {
  return (
    <IconBase>
      <rect x="4" y="5" width="6.2" height="9" rx="0.8" fill="#e7a52e" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
      <path
        d="M4 5 Q4 3 6 3 Q7 4 8.2 3.4 Q9.4 3 10.2 4.4 Q10.4 5 10.2 5.4 Q7 6 4 5 Z"
        fill="#fbf3dd"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="0.4"
      />
      <path d="M10.2 6.4 H12 Q13.4 6.6 13.4 8.6 Q13.4 10.6 12 10.8 H10.2" fill="none" stroke="#e7a52e" strokeWidth="1.3" />
      <line x1="6" y1="7" x2="6" y2="12.4" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
    </IconBase>
  )
}
