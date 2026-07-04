import { IconBase } from './IconBase'

/** Spool of thread: wooden bobbin wound with a trailing strand. */
export function ThreadIcon() {
  return (
    <IconBase>
      <rect x="4.4" y="2.4" width="7.2" height="1.4" rx="0.5" fill="#8a6b2f" />
      <rect x="4.4" y="12.2" width="7.2" height="1.4" rx="0.5" fill="#8a6b2f" />
      <rect x="5.4" y="3.8" width="5.2" height="8.4" fill="#d8c07a" />
      <line x1="5.4" y1="5.4" x2="10.6" y2="5.8" stroke="#a8905a" strokeWidth="0.6" />
      <line x1="5.4" y1="7.6" x2="10.6" y2="8" stroke="#a8905a" strokeWidth="0.6" />
      <line x1="5.4" y1="9.8" x2="10.6" y2="10.2" stroke="#a8905a" strokeWidth="0.6" />
      <path d="M10.6 6 Q13 6.6 12.4 9" fill="none" stroke="#d8c07a" strokeWidth="0.9" />
    </IconBase>
  )
}
