import { IconBase } from './IconBase'

/** Two stacked logs with pale end grain; color varies by wood type. */
export function LogsIcon({ color = '#8b5a2b' }: { color?: string }) {
  return (
    <IconBase>
      <rect x="2.2" y="5.6" width="11.6" height="3.1" rx="1.55" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      <circle cx="3.75" cy="7.15" r="1.2" fill="#d9b380" />
      <rect x="2.2" y="9.2" width="11.6" height="3.1" rx="1.55" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      <circle cx="3.75" cy="10.75" r="1.2" fill="#d9b380" />
    </IconBase>
  )
}
