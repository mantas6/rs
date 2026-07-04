import { IconBase } from './IconBase'

/** Empty beer glass: clear tankard with only dregs and a handle. */
export function BeerGlassIcon() {
  return (
    <IconBase>
      <rect x="4" y="4.4" width="6.2" height="9.6" rx="0.8" fill="#cfe0e6" fillOpacity="0.55" stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
      <rect x="4.4" y="11.8" width="5.4" height="2" rx="0.5" fill="#c99a3a" fillOpacity="0.8" />
      <path d="M10.2 5.8 H12 Q13.4 6 13.4 8 Q13.4 10 12 10.2 H10.2" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.1" />
      <line x1="6" y1="6" x2="6" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="0.7" />
    </IconBase>
  )
}
