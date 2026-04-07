interface RingGaugeProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
  sublabel?: string
}

export function RingGauge({
  value,
  max = 100,
  size = 80,
  strokeWidth = 6,
  color = 'var(--gold)',
  label,
  sublabel,
}: RingGaugeProps) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(value / max, 1)
  const dashOffset = circ * (1 - pct)
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(240,168,48,0.18)" strokeWidth={strokeWidth} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 5px ${color}80)` }}
        />
      </svg>
      {label && (
        <div className="text-center -mt-1">
          <div className="metric-value font-bold" style={{ color, fontSize: Math.max(14, size * 0.22) }}>
            {label}
          </div>
          {sublabel && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--t3)' }}>{sublabel}</div>}
        </div>
      )}
    </div>
  )
}
