import type { AgentStatus, ActivityLevel } from '../../types/index'

interface PulsingDotProps {
  status: AgentStatus | ActivityLevel | 'operational' | 'degraded' | 'down'
  size?: number
}

const colorMap: Record<string, string> = {
  active: 'dot-green',
  operational: 'dot-green',
  success: 'dot-green',
  idle: 'dot-gray',
  warning: 'dot-amber',
  degraded: 'dot-amber',
  error: 'dot-red',
  down: 'dot-red',
  info: 'dot-cyan',
}

export function PulsingDot({ status, size = 8 }: PulsingDotProps) {
  const cls = colorMap[status] ?? 'dot-gray'
  return (
    <span
      className={cls}
      style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }}
    />
  )
}
