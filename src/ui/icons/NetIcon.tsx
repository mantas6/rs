import { IconBase } from './IconBase'

/** Small fishing net: meshed hoop on a short wooden handle. */
export function NetIcon() {
  return (
    <IconBase>
      <line x1="5.2" y1="9.8" x2="2" y2="14" stroke="#8b5a2b" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9.2" cy="6.2" r="4.6" fill="rgba(233,222,188,0.15)" stroke="#c9b892" strokeWidth="1.1" />
      <line x1="7.4" y1="2.2" x2="7.4" y2="10.2" stroke="#c9b892" strokeWidth="0.6" />
      <line x1="11" y1="2.2" x2="11" y2="10.2" stroke="#c9b892" strokeWidth="0.6" />
      <line x1="5" y1="4.4" x2="13.4" y2="4.4" stroke="#c9b892" strokeWidth="0.6" />
      <line x1="5" y1="8" x2="13.4" y2="8" stroke="#c9b892" strokeWidth="0.6" />
    </IconBase>
  )
}
