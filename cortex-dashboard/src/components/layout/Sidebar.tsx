import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, GitBranch, TrendingUp, MessageCircle, Wrench,
  BarChart3, Megaphone, Terminal, Layers, Mail, Settings, LogOut,
} from 'lucide-react'
import { useSystemStore } from '../../store/systemStore'
import { PulsingDot } from '../shared/PulsingDot'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  exact?: boolean
  agentId?: string
}

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Command',
    items: [
      { to: '/',             icon: LayoutDashboard, label: 'Overview',    exact: true },
      { to: '/orchestrator', icon: GitBranch,       label: 'Orchestrator' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { to: '/agents/revenue',    icon: TrendingUp,    label: 'Revenue',    agentId: 'a1' },
      { to: '/agents/guest',      icon: MessageCircle, label: 'Guest',      agentId: 'a2' },
      { to: '/agents/operations', icon: Wrench,        label: 'Operations', agentId: 'a3' },
      { to: '/agents/analytics',  icon: BarChart3,     label: 'Analytics',  agentId: 'a4' },
      { to: '/agents/marketing',  icon: Megaphone,     label: 'Marketing',  agentId: 'a5' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { to: '/inputs',       icon: Terminal, label: 'Inputs' },
      { to: '/integrations', icon: Layers,   label: 'Integrations' },
      { to: '/email-triage', icon: Mail,     label: 'Email Triage' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

const AGENT_ACCENT: Record<string, string> = {
  a1: '#D4920A',   // vivid amber
  a2: '#1A7A44',   // vivid forest green
  a3: '#C9501A',   // vivid terracotta
  a4: '#0E8F6A',   // vivid teal-green
  a5: '#7C3FC0',   // vivid purple
}

export function Sidebar({ open, onToggle: _onToggle }: SidebarProps) {
  const agents = useSystemStore(s => s.agents)
  const navigate = useNavigate()

  return (
    <aside style={{
      width: open ? 228 : 56,
      minWidth: open ? 228 : 56,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>
      {/* Logo / Brand */}
      <div style={{
        display: 'flex',
        flexDirection: open ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: open ? 'center' : 'center',
        padding: open ? '18px 16px 14px' : '14px 0',
        borderBottom: '1px solid var(--border)',
        gap: open ? 10 : 0,
        minHeight: 72,
        transition: 'padding 0.22s',
        overflow: 'hidden',
      }}>
        {open && (
          <>
            <img
              src="/logo.png"
              alt="Solnest Stays"
              style={{
                width: '100%', maxWidth: 160, height: 'auto',
                objectFit: 'contain',
                filter: 'none',
              }}
            />
            <div style={{
              fontSize: 10, fontWeight: 600,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--t3)', whiteSpace: 'nowrap',
            }}>
              STR Dashboard
            </div>
          </>
        )}
        {!open && (
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(15,15,15,0.06)',
            border: '1px solid rgba(15,15,15,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 14, color: '#0F0F0E' }}>S</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: open ? '14px 10px' : '10px 8px' }}>
        {navSections.map(section => (
          <div key={section.label} style={{ marginBottom: open ? 22 : 16 }}>
            {/* Section label — hidden when collapsed */}
            {open && (
              <div style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--t3)', padding: '0 8px 8px',
              }}>
                {section.label}
              </div>
            )}

            {section.items.map(item => {
              const agent  = item.agentId ? agents.find(a => a.id === item.agentId) : null
              const accent = item.agentId ? AGENT_ACCENT[item.agentId] : 'var(--gold)'

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  title={!open ? item.label : undefined}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: open ? 10 : 0,
                    padding: open ? '9px 10px' : '9px 0',
                    justifyContent: open ? 'flex-start' : 'center',
                    borderRadius: 7,
                    marginBottom: 2,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? accent : 'var(--t2)',
                    background: isActive ? `${accent}16` : 'transparent',
                    borderLeft: open ? (isActive ? `2px solid ${accent}` : '2px solid transparent') : 'none',
                    transition: 'all 0.15s ease',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={15}
                        style={{ color: isActive ? accent : 'var(--t3)', flexShrink: 0 }}
                      />
                      {open && (
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                      )}
                      {open && agent && <PulsingDot status={agent.status} size={6} />}
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {/* Logout button */}
        <button
          onClick={() => navigate('/login')}
          title="Log out"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: open ? 10 : 0,
            justifyContent: open ? 'flex-start' : 'center',
            padding: open ? '11px 18px' : '11px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--t3)',
            fontSize: 13,
            fontWeight: 500,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--red)'
            e.currentTarget.style.background = 'rgba(192,57,43,0.05)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--t3)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          {open && <span>Log out</span>}
        </button>

        {/* Status */}
        <div style={{ padding: open ? '12px 16px' : '10px 0', textAlign: open ? 'left' : 'center' }}>
          {open ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <PulsingDot status="active" size={7} />
                <span style={{ fontSize: 12, color: '#3D3D39' }}>System operational</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.02em' }}>
                v2.4.1 · claude-sonnet-4-6
              </div>
            </>
          ) : (
            <PulsingDot status="active" size={7} />
          )}
        </div>
      </div>
    </aside>
  )
}
