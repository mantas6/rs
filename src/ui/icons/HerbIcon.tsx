import { IconBase } from './IconBase'

/** A leafy herb sprig. Grimy herbs use a muddier colour than clean ones. */
export function HerbIcon({ color = '#3faf5a' }: { color?: string }) {
  return (
    <IconBase>
      <path d="M8 14 V5" stroke="#6b4a24" strokeWidth="1" fill="none" />
      <path d="M8 6 Q4 5 3 8 Q6 9 8 7 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      <path d="M8 8 Q12 7 13 10 Q10 11 8 9 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      <path d="M8 5 Q6 3 8 1.6 Q10 3 8 5 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
    </IconBase>
  )
}
