import { IconBase } from './IconBase'

/** Boot — Agility skill glyph; also the run toggle (via currentColor). */
export function BootIcon({ color = '#8b5a2b' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M5 2.4 H9.2 V8 Q12.6 8.4 13.6 10.8 Q14.2 12.8 12.4 13 H4.4 Q3.2 13 3.2 11.8 V10.9 Q3.2 10 4.2 9.7 L5 9.4 Z"
        fill={color}
      />
    </IconBase>
  )
}
