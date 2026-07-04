import { IconBase } from './IconBase'

/** A rounded potion flask filled with coloured liquid (finished potions). */
export function PotionVialIcon({ color = '#3faf5a' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M6.8 2.4 H9.2 V5.2 L11.9 10.2 Q12.9 13.4 9.7 13.7 H6.3 Q3.1 13.4 4.1 10.2 L6.8 5.2 Z"
        fill="#c3d7dd"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.4"
      />
      <path d="M5.1 8.4 H10.9 L11.9 10.2 Q12.9 13.4 9.7 13.7 H6.3 Q3.1 13.4 4.1 10.2 Z" fill={color} />
      <rect x="6.3" y="1.2" width="3.4" height="1.2" fill="#8a6b2f" />
    </IconBase>
  )
}
