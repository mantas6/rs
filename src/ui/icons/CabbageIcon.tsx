import { IconBase } from './IconBase'

/** Cabbage: layered green leaves forming a round head. */
export function CabbageIcon() {
  return (
    <IconBase>
      <circle cx="8" cy="8.4" r="5.4" fill="#4f9a3f" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
      <path d="M8 3.2 Q10.4 6 8 13.6" fill="none" stroke="#3c7a30" strokeWidth="0.7" />
      <path d="M4 6 Q7 8.4 6.6 13" fill="none" stroke="#3c7a30" strokeWidth="0.7" />
      <path d="M12 6 Q9 8.4 9.4 13" fill="none" stroke="#3c7a30" strokeWidth="0.7" />
      <path d="M3.2 9 Q8 7.6 12.8 9" fill="none" stroke="#6fb85a" strokeWidth="0.7" />
    </IconBase>
  )
}
