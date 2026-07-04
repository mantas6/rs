import { IconBase } from './IconBase'

/** Unstrung bow: a bare curved wooden stave with no string. */
export function UnstrungBowIcon({ color = '#8b5a2b', long = false }: { color?: string; long?: boolean }) {
  // Longbows arc across nearly the full height; shortbows are more compact.
  const d = long ? 'M6 1 Q13.5 8 6 15' : 'M6 3 Q12.5 8 6 13'
  return (
    <IconBase>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  )
}
