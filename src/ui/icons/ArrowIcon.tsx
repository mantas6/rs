import { IconBase } from './IconBase'

/** Fletched arrow — the Fletching skill glyph. */
export function ArrowIcon() {
  return (
    <IconBase>
      <line x1="3" y1="13" x2="11.6" y2="4.4" stroke="#8b5a2b" strokeWidth="1.2" />
      <polygon points="13.8,2.2 13.2,6 10,2.8" fill="#c8ccd2" />
      <line x1="3" y1="13" x2="2.2" y2="10.6" stroke="#d8cfae" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="3" y1="13" x2="5.4" y2="13.8" stroke="#d8cfae" strokeWidth="1.2" strokeLinecap="round" />
    </IconBase>
  )
}
