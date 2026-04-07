import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useToastStore, type ToastType } from '../../store/toastStore'

const STYLES: Record<ToastType, { icon: typeof CheckCircle; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle, color: 'var(--green)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)' },
  error: { icon: AlertCircle, color: 'var(--red)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
  warning: { icon: AlertTriangle, color: 'var(--amber)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
  info: { icon: Info, color: '#00E5FF', bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.3)' },
}

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    <div
      style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}
    >
      {toasts.map(toast => {
        const s = STYLES[toast.type]
        const Icon = s.icon
        return (
          <div
            key={toast.id}
            className="feed-entry"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 8,
              background: s.bg,
              border: `1px solid ${s.border}`,
              backdropFilter: 'blur(12px)',
              minWidth: 260,
              maxWidth: 360,
              pointerEvents: 'auto',
              boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
            }}
          >
            <Icon size={15} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--t1)', lineHeight: 1.4 }}>{toast.message}</span>
            <button
              onClick={() => remove(toast.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 0, flexShrink: 0 }}
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
