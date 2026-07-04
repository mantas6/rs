import { IconBase } from './IconBase'

/** Woodcutting axe: angled wooden haft with a bearded blade. */
export function AxeIcon({ color = '#b8bec6' }: { color?: string }) {
  return (
    <IconBase>
      <line x1="11" y1="4.5" x2="3" y2="13.5" stroke="#8b5a2b" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 2.2 L12.8 3.2 Q14.6 6 12.6 9 L8 5.8 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
    </IconBase>
  )
}
