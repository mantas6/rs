import { IconBase } from './IconBase'

/** Mining pickaxe: arched head on a vertical wooden haft. */
export function PickaxeIcon({ color = '#b8bec6' }: { color?: string }) {
  return (
    <IconBase>
      <line x1="8.4" y1="3.6" x2="8.4" y2="14.4" stroke="#8b5a2b" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M2.8 5.6 Q8.5 0.8 14 5.6 L13 6.8 Q8.5 3 3.8 6.8 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
    </IconBase>
  )
}
