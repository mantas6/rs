import { IconBase } from './IconBase'

/** Red heart — the Hitpoints skill glyph. */
export function HeartIcon() {
  return (
    <IconBase>
      <path
        d="M8 14 Q2 9.5 2 5.8 Q2 2.8 4.8 2.8 Q6.8 2.8 8 4.8 Q9.2 2.8 11.2 2.8 Q14 2.8 14 5.8 Q14 9.5 8 14 Z"
        fill="#c0392b"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.5"
      />
      <circle cx="5.6" cy="5" r="0.9" fill="rgba(255,255,255,0.3)" />
    </IconBase>
  )
}
