import { IconBase } from './IconBase'

/** A small handful of seeds; color distinguishes the crop. */
export function SeedIcon({ color = '#caa46a' }: { color?: string }) {
  return (
    <IconBase>
      <ellipse cx="6" cy="6.4" rx="1.8" ry="2.6" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" transform="rotate(-25 6 6.4)" />
      <ellipse cx="10.2" cy="7.8" rx="1.8" ry="2.6" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" transform="rotate(20 10.2 7.8)" />
      <ellipse cx="7.6" cy="11" rx="1.8" ry="2.6" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" transform="rotate(-10 7.6 11)" />
    </IconBase>
  )
}
