import { IconBase } from './IconBase'

/** Sewing needle: slim steel shaft with an eye near the top. */
export function NeedleIcon() {
  return (
    <IconBase>
      <line x1="4" y1="13.4" x2="11.6" y2="3" stroke="#c8ccd2" strokeWidth="1.4" strokeLinecap="round" />
      <polygon points="4,13.4 3.2,12.2 5.2,11.6" fill="#9aa0a6" />
      <ellipse cx="11.4" cy="3.4" rx="1" ry="1.6" fill="none" stroke="#c8ccd2" strokeWidth="0.9" transform="rotate(45 11.4 3.4)" />
    </IconBase>
  )
}
