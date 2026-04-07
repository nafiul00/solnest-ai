import { useState } from 'react'
import { cn } from '@/lib/utils'

interface DataPoint {
  label: string
  value: number
}

interface MiniChartProps {
  data: DataPoint[]
  className?: string
  color?: string
  formatValue?: (v: number) => string
}

const CHART_HEIGHT = 48

export function MiniChart({ data, className, color = 'var(--gold)', formatValue }: MiniChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1

  const fmt = formatValue ?? ((v: number) => v.toLocaleString())

  return (
    <div
      className={cn('relative flex items-end gap-[3px]', className)}
      style={{ height: CHART_HEIGHT }}
    >
      {data.map((point, i) => {
        const barHeight = Math.max(4, Math.round(((point.value - min) / range) * (CHART_HEIGHT * 0.7) + CHART_HEIGHT * 0.3))
        const isHovered = hoveredIndex === i

        return (
          <div
            key={i}
            className="relative flex-1"
            style={{ height: CHART_HEIGHT, display: 'flex', alignItems: 'flex-end' }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Tooltip */}
            {isHovered && (
              <div
                style={{
                  position: 'absolute',
                  bottom: barHeight + 6,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 20,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 4px 12px rgba(10,10,9,0.12)',
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Sans', sans-serif" }}>{point.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'DM Sans', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(point.value)}
                </div>
              </div>
            )}

            {/* Bar */}
            <div
              style={{
                width: '100%',
                height: barHeight,
                borderRadius: 3,
                background: color,
                opacity: isHovered ? 1 : 0.55,
                boxShadow: isHovered ? `0 0 8px ${color}99` : 'none',
                transition: 'opacity 0.12s, box-shadow 0.12s',
                cursor: 'default',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
