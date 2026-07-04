import { IconBase } from './IconBase'

/**
 * A small glass vial. With a `liquid` colour it is filled (a vial of water);
 * without one it renders empty.
 */
export function VialIcon({ liquid }: { liquid?: string }) {
  return (
    <IconBase>
      <path
        d="M6 2 H10 V4 L11 6 V12 Q11 13.6 9.4 13.6 H6.6 Q5 13.6 5 12 V6 L6 4 Z"
        fill="#cde0e6"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.4"
      />
      {liquid && <path d="M5 8 H11 V12 Q11 13.6 9.4 13.6 H6.6 Q5 13.6 5 12 Z" fill={liquid} />}
      <rect x="5.6" y="1.2" width="4.8" height="1.2" fill="#8a6b2f" />
    </IconBase>
  )
}
