import { IconBase } from './IconBase'

/** Onion: round bulb with papery skin lines and a green sprout. */
export function OnionIcon() {
  return (
    <IconBase>
      <path d="M8 4 Q7 2.6 8 1.4 Q9 2.6 8 4" fill="#5b8f3a" />
      <path
        d="M8 3.8 Q13 4.6 12.4 9.6 Q11.8 14 8 14 Q4.2 14 3.6 9.6 Q3 4.6 8 3.8 Z"
        fill="#e6d9a8"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.5"
      />
      <path d="M6 5.2 Q6.6 9.4 7.2 13.6" fill="none" stroke="#c9b878" strokeWidth="0.6" />
      <path d="M10 5.2 Q9.4 9.4 8.8 13.6" fill="none" stroke="#c9b878" strokeWidth="0.6" />
    </IconBase>
  )
}
