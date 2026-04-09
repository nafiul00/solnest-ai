import { useState } from 'react'
import { Bell, X, RefreshCw, Search, CheckCheck, PanelLeftClose, LogOut } from 'lucide-react'
import { useSystemStore } from '../../store/systemStore'
import { useAuthStore } from '../../store/authStore'
import { format } from 'date-fns'

interface NavbarProps {
  title: string
  subtitle?: string
  onSidebarToggle?: () => void
}

const notifLevelColor: Record<string, string> = {
  warning: 'var(--gold)',
  success: 'var(--sage)',
  error:   'var(--red)',
  info:    'var(--mist)',
}

const notifLevelBg: Record<string, string> = {
  warning: 'rgba(184,134,11,0.07)',
  success: 'rgba(44,110,73,0.07)',
  error:   'rgba(192,57,43,0.07)',
  info:    'rgba(59,122,87,0.07)',
}

export function Navbar({ title, subtitle, onSidebarToggle }: NavbarProps) {
  const {
    systemHealth, notifications, clearNotification,
    markNotificationRead, markAllNotificationsRead, agents,
  } = useSystemStore()
  const { email, logout } = useAuthStore()
  const [showNotifs, setShowNotifs] = useState(false)

  const activeCount = agents.filter(a => a.status === 'active').length
  const unread = notifications.filter(n => !n.read).length
  const healthColor = systemHealth.score >= 90 ? 'var(--sage)' : systemHealth.score >= 70 ? 'var(--gold)' : 'var(--red)'

  function openNotifPanel() {
    setShowNotifs(s => !s)
  }

  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 22px', height: 56, minHeight: 56,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 20, flexShrink: 0,
    }}>
      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--t1)', lineHeight: 1, letterSpacing: '-0.01em' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>{subtitle}</div>
        )}
      </div>

      {/* Sidebar toggle */}
      {onSidebarToggle && (
        <button className="btn-icon" onClick={onSidebarToggle} title="Toggle sidebar">
          <PanelLeftClose size={15} color="var(--t3)" />
        </button>
      )}

      {/* Search */}
      <button className="btn-icon" title="Search (⌘K)">
        <Search size={14} color="var(--t3)" />
      </button>

      {/* Clock */}
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--t3)', letterSpacing: '0.03em' }}>
        {format(new Date(), 'EEE d MMM · HH:mm')}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Agents pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 20,
        background: 'rgba(184,134,11,0.08)',
        border: '1px solid rgba(184,134,11,0.22)',
        flexShrink: 0,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage)', boxShadow: '0 0 6px rgba(44,110,73,0.5)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>
          {activeCount}/{agents.length} agents
        </span>
      </div>

      {/* Health chip */}
      <div title={`System Health: ${systemHealth.score}%`} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 20,
        background: `color-mix(in srgb, ${healthColor} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${healthColor} 28%, transparent)`,
        flexShrink: 0,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: healthColor, flexShrink: 0 }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: healthColor }}>
          {systemHealth.score}%
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Notification bell */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          className="btn-icon"
          onClick={openNotifPanel}
          style={{ borderColor: unread > 0 ? 'rgba(184,134,11,0.35)' : 'transparent' }}
        >
          <Bell size={15} color={unread > 0 ? 'var(--gold)' : 'var(--t3)'} />
        </button>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 8,
            background: 'var(--red)', color: '#fff',
            fontSize: 10, fontWeight: 700,
            lineHeight: '16px', textAlign: 'center',
            padding: '0 4px',
            border: '2px solid var(--bg-surface)',
            pointerEvents: 'none',
            zIndex: 1,
            boxSizing: 'content-box',
          }}>
            {unread}
          </span>
        )}

        {showNotifs && (
          <>
            {/* Backdrop */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={() => setShowNotifs(false)}
            />
            {/* Panel */}
            <div style={{
              position: 'absolute', right: 0, top: 44,
              width: 340, borderRadius: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-mid)',
              boxShadow: '0 20px 60px rgba(15,15,15,0.12)',
              zIndex: 50, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '13px 16px', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', flex: 1 }}>
                  Notifications
                </span>
                {unread > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--gold)',
                    background: 'rgba(184,134,11,0.10)',
                    padding: '2px 8px', borderRadius: 10,
                    border: '1px solid rgba(184,134,11,0.25)',
                  }}>
                    {unread} unread
                  </span>
                )}
                {notifications.length > 0 && (
                  <button
                    className="btn-icon"
                    title="Mark all as read"
                    onClick={markAllNotificationsRead}
                    style={{ color: 'var(--t3)' }}
                  >
                    <CheckCheck size={13} />
                  </button>
                )}
                <button className="btn-icon" onClick={() => setShowNotifs(false)}>
                  <X size={13} />
                </button>
              </div>

              {/* Items */}
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      borderLeft: `3px solid ${n.read ? 'transparent' : (notifLevelColor[n.level] ?? 'var(--border-mid)')}`,
                      background: n.read ? 'transparent' : notifLevelBg[n.level] ?? 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(15,15,15,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : (notifLevelBg[n.level] ?? 'transparent'))}
                  >
                    {/* Unread dot */}
                    <div style={{ paddingTop: 4, flexShrink: 0 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: n.read ? 'var(--border)' : (notifLevelColor[n.level] ?? 'var(--t3)'),
                        transition: 'background 0.3s',
                      }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, color: n.read ? 'var(--t3)' : 'var(--t2)',
                        lineHeight: 1.5,
                        transition: 'color 0.3s',
                      }}>
                        {n.message}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>{n.time}</p>
                    </div>

                    <button
                      className="btn-icon"
                      onClick={e => { e.stopPropagation(); clearNotification(n.id) }}
                      style={{ flexShrink: 0, opacity: 0.5 }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
                    All clear — no notifications
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div style={{
                  padding: '10px 16px', borderTop: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <button
                    style={{ fontSize: 12, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={markAllNotificationsRead}
                  >
                    Mark all read
                  </button>
                  <button
                    style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => notifications.forEach(n => clearNotification(n.id))}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Refresh */}
      <button
        className="btn-icon"
        title="Refresh data"
        onClick={() => window.location.reload()}
      >
        <RefreshCw size={13} color="var(--t3)" />
      </button>

      {/* User / logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(184,134,11,0.12)',
          border: '1px solid rgba(184,134,11,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'var(--gold)',
          flexShrink: 0,
        }}>
          {email ? email[0].toUpperCase() : 'A'}
        </div>
        <button
          className="btn-icon"
          title="Sign out"
          onClick={logout}
        >
          <LogOut size={13} color="var(--t3)" />
        </button>
      </div>
    </header>
  )
}
