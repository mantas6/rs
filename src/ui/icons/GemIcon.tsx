import { IconBase } from './IconBase'

/** Faceted cut gem — the Crafting skill glyph. */
export function GemIcon() {
  return (
    <IconBase>
      <polygon points="5,3.2 11,3.2 14,6.8 8,13.6 2,6.8" fill="#3aa0d8" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      <path
        d="M2.4 6.8 H13.6 M5 3.2 L8 6.8 L11 3.2 M8 6.8 V13.2"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.6"
      />
    </IconBase>
  )
}
