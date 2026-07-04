import { IconBase } from './IconBase'

/** Chicken drumstick: meat on a knobbed bone; color shows doneness. */
export function DrumstickIcon({ color = '#d29a56' }: { color?: string }) {
  return (
    <IconBase>
      <line x1="9.4" y1="9.4" x2="12.6" y2="12.6" stroke="#ece5d3" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="13.4" cy="11.9" r="1.1" fill="#ece5d3" />
      <circle cx="11.9" cy="13.4" r="1.1" fill="#ece5d3" />
      <ellipse
        cx="6.6"
        cy="6.6"
        rx="4.1"
        ry="3.3"
        transform="rotate(45 6.6 6.6)"
        fill={color}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.4"
      />
    </IconBase>
  )
}
