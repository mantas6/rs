import { IconBase } from './IconBase'

/** Backpack — the inventory tab icon. Inherits button color. */
export function BackpackIcon() {
  return (
    <IconBase>
      <path d="M5.8 5 Q5.8 2.4 8 2.4 Q10.2 2.4 10.2 5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3.6" y="5" width="8.8" height="8.4" rx="2" fill="currentColor" />
      <rect x="5.8" y="8.2" width="4.4" height="3" rx="0.8" fill="rgba(0,0,0,0.35)" />
    </IconBase>
  )
}
