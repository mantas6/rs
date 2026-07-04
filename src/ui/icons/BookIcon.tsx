import { IconBase } from './IconBase'

/** Open book — the Guide tab icon. Inherits button color. */
export function BookIcon() {
  return (
    <IconBase>
      <path
        d="M8 3.4 C6.4 2.4 4 2.4 2.4 3 L2.4 12.6 C4 12 6.4 12 8 13 C9.6 12 12 12 13.6 12.6 L13.6 3 C12 2.4 9.6 2.4 8 3.4 Z"
        fill="currentColor"
      />
      <path d="M8 3.4 L8 13" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
    </IconBase>
  )
}
