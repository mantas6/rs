import { IconBase } from './IconBase'

/** Circular restart arrow — the new-game/reset button icon. */
export function ResetIcon() {
  return (
    <IconBase>
      <path
        d="M13.2 8 A5.2 5.2 0 1 1 11.6 4.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <polygon points="10.2,1.6 14.4,2.4 11.6,5.6" fill="currentColor" />
    </IconBase>
  )
}
