import { IconBase } from './IconBase'

/** Strung bow: a curved wooden stave with a taut string across the tips. */
export function BowIcon({ color = '#8b5a2b', long = false }: { color?: string; long?: boolean }) {
  // Longbows arc across nearly the full height; shortbows are more compact.
  const stave = long ? 'M6 1 Q13.5 8 6 15' : 'M6 3 Q12.5 8 6 13'
  const y1 = long ? 1 : 3
  const y2 = long ? 15 : 13
  return (
    <IconBase>
      <path d={stave} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="6" y1={y1} x2="6" y2={y2} stroke="#e8e0c8" strokeWidth="0.7" />
    </IconBase>
  )
}
