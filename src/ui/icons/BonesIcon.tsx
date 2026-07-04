import { IconBase } from './IconBase'

/** A single diagonal bone with knobbed ends. */
export function BonesIcon() {
  return (
    <IconBase>
      <line x1="5.4" y1="10.6" x2="10.6" y2="5.4" stroke="#ece5d3" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="4.6" cy="9.8" r="1.4" fill="#ece5d3" />
      <circle cx="6.2" cy="11.4" r="1.4" fill="#ece5d3" />
      <circle cx="9.8" cy="4.6" r="1.4" fill="#ece5d3" />
      <circle cx="11.4" cy="6.2" r="1.4" fill="#ece5d3" />
    </IconBase>
  )
}
