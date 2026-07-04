import { IconBase } from './IconBase'

/** Eye of newt: a pale eyeball with a dark iris. */
export function NewtEyeIcon() {
  return (
    <IconBase>
      <circle cx="8" cy="8" r="5.4" fill="#f2efe6" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
      <circle cx="8" cy="8" r="2.6" fill="#3b7d4a" />
      <circle cx="8" cy="8" r="1.1" fill="#1a1a1a" />
      <path d="M4 6 Q6 5 8 5.4" fill="none" stroke="#c33" strokeWidth="0.5" />
      <path d="M12 10 Q10 11 8.6 10.6" fill="none" stroke="#c33" strokeWidth="0.5" />
    </IconBase>
  )
}
