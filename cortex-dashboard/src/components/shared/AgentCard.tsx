import { PulsingDot } from './PulsingDot'
import { StatusBadge } from './StatusBadge'
import type { Agent } from '../../types/index'

interface AgentCardProps {
  agent: Agent
  compact?: boolean
  onClick?: () => void
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 96
  const h = 32
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)

  // Build filled area path
  const firstX = 0
  const lastX = w
  const area = `M${firstX},${h} ` + pts.map((p, i) => (i === 0 ? `L${p}` : `L${p}`)).join(' ') + ` L${lastX},${h} Z`

  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <path
        d={area}
        fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`}
      />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Warm nature palette — matches logo vibe
const AGENT_COLORS: Record<string, string> = {
  a1: 'var(--gold)',       // Revenue   — amber gold (the sun)
  a2: 'var(--sage)',       // Guest     — forest sage
  a3: 'var(--terracotta)', // Operations — warm earth
  a4: 'var(--mist)',       // Analytics — cool mist
  a5: 'var(--purple)',     // Marketing — soft plum
}

export function AgentCard({ agent, compact = false, onClick }: AgentCardProps) {
  const color = AGENT_COLORS[agent.id] ?? 'var(--gold)'

  if (compact) {
    return (
      <div
        className="card lift"
        onClick={onClick}
        style={{
          padding: '14px 16px',
          cursor: 'pointer',
          borderTop: `2px solid ${agent.status === 'error' ? 'var(--red)' : color}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <PulsingDot status={agent.status} size={7} />
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--t1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {agent.name}
          </span>
        </div>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          color: 'var(--t3)',
          lineHeight: 1.55,
          marginBottom: 10,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {agent.lastAction}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Sparkline data={agent.sparkline} color={color} />
          <div style={{ textAlign: 'right' }}>
            <div className="t-metric" style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>
              {agent.tasksCompleted}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>tasks</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="card lift"
      onClick={onClick}
      style={{
        padding: '16px 18px',
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <PulsingDot status={agent.status} size={8} />
            <span style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--t1)',
            }}>
              {agent.name}
            </span>
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--t3)' }}>{agent.role}</div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 14 }}>
        {agent.lastAction}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div className="t-metric" style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>
              {agent.tasksCompleted}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Tasks Today</div>
          </div>
          {agent.errorsToday > 0 && (
            <div>
              <div className="t-metric" style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)', lineHeight: 1 }}>
                {agent.errorsToday}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Errors</div>
            </div>
          )}
        </div>
        <Sparkline data={agent.sparkline} color={color} />
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>
        Last run: {agent.lastRun}
      </div>
    </div>
  )
}
