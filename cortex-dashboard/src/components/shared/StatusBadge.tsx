type BadgeVariant = string

interface StatusBadgeProps {
  status: BadgeVariant
  label?: string
  size?: 'sm' | 'md'
}

interface Variant { color: string; bg: string; border: string; dot?: string }

const VARIANTS: Record<string, Variant> = {
  active:         { color: 'var(--sage)',       bg: 'rgba(44,110,73,0.10)',   border: 'rgba(44,110,73,0.24)',   dot: 'var(--sage)'       },
  operational:    { color: 'var(--sage)',       bg: 'rgba(44,110,73,0.10)',   border: 'rgba(44,110,73,0.24)',   dot: 'var(--sage)'       },
  connected:      { color: 'var(--sage)',       bg: 'rgba(44,110,73,0.10)',   border: 'rgba(44,110,73,0.24)',   dot: 'var(--sage)'       },
  success:        { color: 'var(--sage)',       bg: 'rgba(44,110,73,0.10)',   border: 'rgba(44,110,73,0.24)'                             },
  triaged:        { color: 'var(--sage)',       bg: 'rgba(44,110,73,0.10)',   border: 'rgba(44,110,73,0.24)'                             },
  done:           { color: 'var(--sage)',       bg: 'rgba(44,110,73,0.10)',   border: 'rgba(44,110,73,0.24)'                             },
  idle:           { color: 'var(--t3)',         bg: 'rgba(15,15,15,0.05)',    border: 'rgba(15,15,15,0.14)'                              },
  paused:         { color: 'var(--t3)',         bg: 'rgba(15,15,15,0.05)',    border: 'rgba(15,15,15,0.14)'                              },
  todo:           { color: 'var(--t3)',         bg: 'rgba(15,15,15,0.05)',    border: 'rgba(15,15,15,0.14)'                              },
  low:            { color: 'var(--t2)',         bg: 'rgba(15,15,15,0.04)',    border: 'rgba(15,15,15,0.12)'                              },
  pending:        { color: 'var(--mist)',       bg: 'rgba(59,122,87,0.08)',   border: 'rgba(59,122,87,0.22)'                             },
  medium:         { color: 'var(--gold)',       bg: 'rgba(184,134,11,0.10)',  border: 'rgba(184,134,11,0.24)'                            },
  warning:        { color: 'var(--gold)',       bg: 'rgba(184,134,11,0.10)',  border: 'rgba(184,134,11,0.24)',  dot: 'var(--gold)'        },
  degraded:       { color: 'var(--gold)',       bg: 'rgba(184,134,11,0.10)',  border: 'rgba(184,134,11,0.24)',  dot: 'var(--gold)'        },
  high:           { color: 'var(--terracotta)', bg: 'rgba(181,84,30,0.10)',   border: 'rgba(181,84,30,0.24)'                             },
  error:          { color: 'var(--red)',        bg: 'rgba(192,57,43,0.10)',   border: 'rgba(192,57,43,0.24)',   dot: 'var(--red)'         },
  down:           { color: 'var(--red)',        bg: 'rgba(192,57,43,0.10)',   border: 'rgba(192,57,43,0.24)',   dot: 'var(--red)'         },
  disconnected:   { color: 'var(--red)',        bg: 'rgba(192,57,43,0.10)',   border: 'rgba(192,57,43,0.24)'                             },
  escalated:      { color: 'var(--red)',        bg: 'rgba(192,57,43,0.10)',   border: 'rgba(192,57,43,0.24)'                             },
  urgent:         { color: 'var(--red)',        bg: 'rgba(192,57,43,0.10)',   border: 'rgba(192,57,43,0.24)'                             },
  'auto-resolved':{ color: 'var(--mist)',       bg: 'rgba(59,122,87,0.08)',   border: 'rgba(59,122,87,0.20)'                             },
  'in-progress':  { color: 'var(--mist)',       bg: 'rgba(59,122,87,0.08)',   border: 'rgba(59,122,87,0.20)'                             },
}

const LABELS: Record<string, string> = {
  active:'Active', idle:'Idle', error:'Error', warning:'Warning', paused:'Paused',
  connected:'Connected', disconnected:'Offline', operational:'Operational',
  degraded:'Degraded', down:'Down', pending:'Pending', triaged:'Triaged',
  escalated:'Escalated', 'auto-resolved':'Auto-Resolved', urgent:'Urgent',
  high:'High', medium:'Medium', low:'Low', todo:'To Do', 'in-progress':'In Progress', done:'Done',
}

const FALLBACK: Variant = { color: 'var(--t3)', bg: 'rgba(15,15,15,0.05)', border: 'rgba(15,15,15,0.14)' }

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const v = VARIANTS[status] ?? FALLBACK
  const text = label ?? LABELS[status] ?? status
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 20,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: v.color,
        background: v.bg,
        border: `1px solid ${v.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {v.dot && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: v.dot, flexShrink: 0 }} />
      )}
      {text}
    </span>
  )
}
