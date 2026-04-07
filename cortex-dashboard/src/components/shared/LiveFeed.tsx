import { useRef, useEffect } from 'react'
import clsx from 'clsx'
import type { ActivityEntry } from '../../types/index'

interface LiveFeedProps {
  entries: ActivityEntry[]
  maxHeight?: string
  autoScroll?: boolean
}

const levelColors: Record<string, string> = {
  success: 'var(--sage)',
  info:    'var(--mist)',
  warning: 'var(--gold)',
  error:   'var(--red)',
}

const agentColors: Record<string, string> = {
  Revenue:    'var(--gold)',
  Guest:      'var(--sage)',
  Operations: 'var(--terracotta)',
  Analytics:  'var(--mist)',
  Marketing:  'var(--purple)',
  CORTEX:     'var(--t2)',
}

export function LiveFeed({ entries, maxHeight = '340px', autoScroll = true }: LiveFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(entries.length)

  useEffect(() => {
    if (autoScroll && containerRef.current && entries.length > prevLen.current) {
      containerRef.current.scrollTop = 0
    }
    prevLen.current = entries.length
  }, [entries.length, autoScroll])

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto"
      style={{ maxHeight }}
    >
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          className={clsx('feed-entry flex gap-3 border-b')}
          style={{
            borderColor: 'rgba(160, 200, 150, 0.06)',
            padding: '12px 16px',
            background: i === 0 ? 'rgba(201, 148, 58, 0.03)' : 'transparent',
          }}
        >
          <span
            className="w-1 rounded-full flex-shrink-0"
            style={{ background: levelColors[entry.level] ?? 'var(--t3)', minHeight: 16, marginTop: 3 }}
          />
          <div className="flex-1 min-w-0">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: agentColors[entry.agent] ?? 'var(--t2)',
              }}>
                {entry.agent}
              </span>
              {entry.property && (
                <span style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(201, 148, 58, 0.08)',
                  color: 'var(--t3)',
                  border: '1px solid rgba(201, 148, 58, 0.15)',
                }}>
                  {entry.property}
                </span>
              )}
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                marginLeft: 'auto',
                flexShrink: 0,
                color: 'var(--t3)',
              }}>
                {entry.timestamp}
              </span>
            </div>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--t2)',
            }}>
              {entry.action}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
