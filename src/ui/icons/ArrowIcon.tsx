import { IconBase } from './IconBase'

/**
 * A finished arrow: a wooden shaft with a metal head and feather fletching.
 * `headless` omits the head (used for the headless-arrow intermediate).
 */
export function ArrowIcon({
  color = '#b08d57',
  headless = false,
}: {
  color?: string
  headless?: boolean
}) {
  return (
    <IconBase>
      <line x1="8" y1="3" x2="8" y2="14" stroke="#8b5a2b" strokeWidth="1.2" strokeLinecap="round" />
      {!headless && (
        <polygon points="8,0.8 6.2,3.6 9.8,3.6" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      )}
      <path d="M8 12 L5.6 15 L8 14 Z" fill="#8fae7a" />
      <path d="M8 12 L10.4 15 L8 14 Z" fill="#7a9a66" />
    </IconBase>
  )
}
