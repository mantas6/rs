import { IconBase } from './IconBase'

/** Rune stone with a glowing mark — the Runecraft skill glyph. */
export function RuneIcon() {
  return (
    <IconBase>
      <rect x="2.8" y="3" width="10.4" height="10" rx="2.4" fill="#8f8f8f" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      <path
        d="M6.2 11 V5 L9.8 11 V5"
        fill="none"
        stroke="#f4d03f"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  )
}
