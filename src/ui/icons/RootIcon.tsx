import { IconBase } from './IconBase'

/** Limpwurt root: a knotted taproot with fine tendrils. */
export function RootIcon({ color = '#c9a06a' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M7 2 Q9.5 4 8.5 7 Q10 9 8 11 Q9 13 7 14"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M8.4 6.6 Q11 6 12 4.6" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <path d="M8 10.6 Q5 10.4 3.6 8.8" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <path d="M7.2 13 Q5 13.4 4 13" fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
    </IconBase>
  )
}
