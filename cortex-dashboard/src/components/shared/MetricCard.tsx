import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  change?: string
  changePositive?: boolean
  changeDelta?: number
  icon?: React.ReactNode
  accentColor?: string
  animate?: boolean
  onClick?: () => void
}

function useAnimatedCounter(target: number, duration = 1100) {
  const [current, setCurrent] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    function update(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setCurrent(Math.round(ease * target))
      if (t < 1) raf.current = requestAnimationFrame(update)
    }
    raf.current = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return current
}

export function MetricCard({
  label, value, unit, change, changePositive, changeDelta,
  icon, accentColor = 'var(--gold)', animate = true, onClick,
}: MetricCardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''))
  const isNumeric = !isNaN(numericValue) && animate
  const animated = useAnimatedCounter(isNumeric ? numericValue : 0)

  const displayValue = isNumeric
    ? (typeof value === 'string'
        ? String(value).replace(/[0-9.]+/, String(animated))
        : animated)
    : value

  const isPositive = changePositive !== undefined
    ? changePositive
    : changeDelta !== undefined ? changeDelta > 0 : undefined

  return (
    <div
      className="card lift"
      onClick={onClick}
      style={{
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Warm accent glow blob */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: accentColor,
          opacity: 0.07,
          filter: 'blur(28px)',
          pointerEvents: 'none',
        }}
      />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: 'var(--t3)',
          }}
        >
          {label}
        </span>
        {icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accentColor,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontVariantNumeric: 'tabular-nums',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--t1)',
            letterSpacing: '-0.02em',
          }}
        >
          {displayValue}
        </span>
        {unit && (
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--t3)', marginBottom: 3 }}>{unit}</span>
        )}
      </div>

      {/* Delta */}
      {change && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {isPositive === true  && <TrendingUp  size={12} color="var(--sage)" />}
          {isPositive === false && <TrendingDown size={12} color="var(--red)"  />}
          {isPositive === undefined && <Minus   size={12} color="var(--t3)"   />}
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: isPositive === true ? 'var(--sage)' : isPositive === false ? 'var(--red)' : 'var(--t3)',
          }}>
            {change}
          </span>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--t3)' }}>vs last month</span>
        </div>
      )}
    </div>
  )
}
