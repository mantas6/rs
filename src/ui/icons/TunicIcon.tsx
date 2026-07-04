import { IconBase } from './IconBase'

/** Soft body armour (leather tunic): rounded torso with short sleeves. */
export function TunicIcon({ color = '#c9a86a' }: { color?: string }) {
  return (
    <IconBase>
      <path
        d="M5.4 2.4 Q8 3.8 10.6 2.4 L13.6 4.2 L12 7 L11.4 6.4 V12.6 Q8 14 4.6 12.6 V6.4 L4 7 L2.4 4.2 Z"
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.5"
      />
      <path d="M5.4 2.6 Q8 5.2 10.6 2.6" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.7" />
    </IconBase>
  )
}
