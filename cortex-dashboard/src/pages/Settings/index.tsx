import { useState } from 'react'
import {
  Shield, Key, Lock, Eye, EyeOff, Users, Bell, Globe, Database,
  CheckCircle, AlertTriangle, Cpu, RefreshCw, Trash2, Plus, X,
} from 'lucide-react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PulsingDot } from '../../components/shared/PulsingDot'
import { toast } from '../../store/toastStore'

type Tab = 'security' | 'api-keys' | 'team' | 'notifications' | 'system'

const NOTIFICATION_DEFAULTS: Record<string, boolean> = {
  'Revenue alerts': true,
  'Agent errors': true,
  'New bookings': true,
  'Maintenance tasks': false,
  'Weekly digest': true,
  'Guest messages': true,
}

function NotificationToggle({ title, subtitle }: { title: string; subtitle: string }) {
  const [on, setOn] = useState(NOTIFICATION_DEFAULTS[title] ?? true)
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        style={{
          width: 44, height: 24, borderRadius: 12,
          border: `1.5px solid ${on ? 'var(--mist)' : 'var(--border-mid)'}`,
          background: on ? 'rgba(201,148,58,0.12)' : 'var(--bg-surface)',
          position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: on ? 22 : 3,
          width: 14, height: 14, borderRadius: '50%',
          background: on ? 'var(--mist)' : 'var(--t3)',
          transition: 'left 0.2s, background 0.2s',
        }} />
      </button>
    </div>
  )
}

const INITIAL_SESSIONS = [
  { id: 's1', device: 'MacBook Pro · Chrome', location: 'Vancouver, BC', ip: '192.168.1.42', lastSeen: '2 min ago',  current: true  },
  { id: 's2', device: 'iPhone 15 · Safari',   location: 'Vancouver, BC', ip: '192.168.1.55', lastSeen: '1 hr ago',   current: false },
  { id: 's3', device: 'Windows PC · Edge',    location: 'Toronto, ON',   ip: '216.58.1.100', lastSeen: '3 days ago', current: false },
]

const INITIAL_API_KEYS = [
  { id: 'k1', name: 'Anthropic Claude',    key: 'sk-ant-••••••••••••3fAQ', env: 'production', status: 'active',   lastUsed: '1 min ago'  },
  { id: 'k2', name: 'Apify Scraper',       key: 'apify_api_••••••••••xQ8', env: 'production', status: 'active',   lastUsed: '5 min ago'  },
  { id: 'k3', name: 'PriceLabs',           key: 'pl_••••••••••••••••',     env: 'production', status: 'active',   lastUsed: '12 min ago' },
  { id: 'k4', name: 'Hospitable',          key: 'hosp_••••••••••••',      env: 'production', status: 'active',   lastUsed: '1 hr ago'   },
  { id: 'k5', name: 'AirDNA',              key: 'airdna_••••••••',        env: 'staging',    status: 'idle',     lastUsed: '3 days ago' },
  { id: 'k6', name: 'Slack Webhook',       key: 'https://hooks.slack.com/••••', env: 'production', status: 'active', lastUsed: '7 min ago' },
]

const INITIAL_TEAM = [
  { id: 'u1', name: 'Alex Rivera',  email: 'alex@solnestai.com',   role: 'Admin',       status: 'active', avatar: 'AR', last: '2 min ago' },
  { id: 'u2', name: 'Jordan Lee',   email: 'jordan@solnestai.com', role: 'Team Member', status: 'active', avatar: 'JL', last: '34 min ago' },
  { id: 'u3', name: 'Sam Ortega',   email: 'sam@solnestai.com',    role: 'Team Member', status: 'idle',   avatar: 'SO', last: '2 hr ago' },
  { id: 'u4', name: 'Chris Park',   email: 'chris@client.com',     role: 'Client',      status: 'idle',   avatar: 'CP', last: '1 day ago' },
]

const AUDIT_LOG = [
  { id: 'a1', action: 'Pricing rule updated',      user: 'Alex Rivera',  time: '2 min ago',  level: 'info'    },
  { id: 'a2', action: 'Revenue agent triggered',   user: 'System',       time: '8 min ago',  level: 'success' },
  { id: 'a3', action: 'API key rotated (PriceLabs)', user: 'Alex Rivera', time: '1 hr ago',  level: 'warning' },
  { id: 'a4', action: 'New team member invited',   user: 'Alex Rivera',  time: '3 hr ago',   level: 'info'    },
  { id: 'a5', action: 'Failed login attempt',      user: '216.58.1.200', time: '5 hr ago',   level: 'error'   },
  { id: 'a6', action: 'Settings exported',         user: 'Jordan Lee',   time: '1 day ago',  level: 'info'    },
  { id: 'a7', action: 'Automation rule created',   user: 'Alex Rivera',  time: '2 days ago', level: 'success' },
]

const LEVEL_COLOR: Record<string, string> = {
  success: 'var(--green)', info: 'var(--mist)', warning: 'var(--amber)', error: 'var(--red)',
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('security')
  const [showKey, setShowKey] = useState<string | null>(null)
  const [twoFA, setTwoFA] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState('8h')
  const [ipAllow, setIpAllow] = useState(false)

  // Sessions state
  const [sessions, setSessions] = useState(INITIAL_SESSIONS)

  // API Keys state
  const [apiKeys, setApiKeys] = useState(INITIAL_API_KEYS)
  const [showAddKey, setShowAddKey] = useState(false)
  const [newKey, setNewKey] = useState({ name: '', key: '', env: 'production' })

  // Team state
  const [team, setTeam] = useState(INITIAL_TEAM)
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({ name: '', email: '', role: 'Team Member' })
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({ name: '', email: '', role: '' })

  const TABS: Array<{ id: Tab; label: string; icon: typeof Shield }> = [
    { id: 'security',      label: 'Security',      icon: Shield },
    { id: 'api-keys',      label: 'API Keys',       icon: Key    },
    { id: 'team',          label: 'Team',           icon: Users  },
    { id: 'notifications', label: 'Notifications',  icon: Bell   },
    { id: 'system',        label: 'System',         icon: Cpu    },
  ]

  function revokeSession(id: string) {
    setSessions(prev => prev.filter(s => s.id !== id))
    toast.warning('Session revoked')
  }

  function addApiKey() {
    if (!newKey.name.trim() || !newKey.key.trim()) {
      toast.error('Name and key are required')
      return
    }
    setApiKeys(prev => [...prev, {
      id: `k-${Date.now()}`,
      name: newKey.name,
      key: newKey.key,
      env: newKey.env,
      status: 'active',
      lastUsed: 'just now',
    }])
    setNewKey({ name: '', key: '', env: 'production' })
    setShowAddKey(false)
    toast.success(`API key "${newKey.name}" added`)
  }

  function rotateKey(id: string, name: string) {
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, lastUsed: 'just now' } : k))
    toast.info(`Key rotation initiated for ${name}`)
  }

  function deleteKey(id: string, name: string) {
    setApiKeys(prev => prev.filter(k => k.id !== id))
    toast.warning(`API key "${name}" deleted`)
  }

  function inviteMember() {
    if (!invite.name.trim() || !invite.email.trim()) {
      toast.error('Name and email are required')
      return
    }
    const initials = invite.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    setTeam(prev => [...prev, {
      id: `u-${Date.now()}`,
      name: invite.name,
      email: invite.email,
      role: invite.role,
      status: 'idle',
      avatar: initials,
      last: 'Invited',
    }])
    toast.success(`Invitation sent to ${invite.email}`)
    setInvite({ name: '', email: '', role: 'Team Member' })
    setShowInvite(false)
  }

  function startEdit(u: typeof INITIAL_TEAM[0]) {
    setEditingMember(u.id)
    setEditValues({ name: u.name, email: u.email, role: u.role })
  }

  function saveEdit(id: string) {
    setTeam(prev => prev.map(u => u.id === id ? { ...u, ...editValues } : u))
    setEditingMember(null)
    toast.success('Team member updated')
  }

  function deleteMember(id: string, name: string) {
    setTeam(prev => prev.filter(u => u.id !== id))
    toast.warning(`${name} removed from team`)
  }

  return (
    <PageWrapper>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--t1)' : 'var(--t3)',
                background: 'none', border: 'none',
                borderBottom: `2px solid ${active ? 'var(--mist)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.15s',
                marginBottom: -1, fontFamily: 'inherit',
              }}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── SECURITY ── */}
      {tab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Authentication */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Lock size={15} color="var(--mist)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Authentication</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>Two-Factor Authentication</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>TOTP via authenticator app</div>
              </div>
              <button
                onClick={() => { setTwoFA(!twoFA); toast.info(twoFA ? '2FA disabled' : '2FA enabled') }}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  border: `1.5px solid ${twoFA ? 'var(--mist)' : 'var(--border-mid)'}`,
                  background: twoFA ? 'rgba(201,148,58,0.15)' : 'var(--bg-surface)',
                  position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: twoFA ? 22 : 3,
                  width: 14, height: 14, borderRadius: '50%',
                  background: twoFA ? 'var(--mist)' : 'var(--t3)',
                  transition: 'left 0.2s, background 0.2s',
                }} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>Session Timeout</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Auto-logout after inactivity</div>
              </div>
              <select
                value={sessionTimeout}
                onChange={e => { setSessionTimeout(e.target.value); toast.info(`Session timeout set to ${e.target.value}`) }}
                style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
              >
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="8h">8 hours</option>
                <option value="24h">24 hours</option>
                <option value="never">Never</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>IP Allowlist</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Restrict admin to specific IPs</div>
              </div>
              <button
                onClick={() => { setIpAllow(!ipAllow); toast.info(ipAllow ? 'IP allowlist disabled' : 'IP allowlist enabled') }}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  border: `1.5px solid ${ipAllow ? 'var(--green)' : 'var(--border-mid)'}`,
                  background: ipAllow ? 'rgba(34,211,160,0.12)' : 'var(--bg-surface)',
                  position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: ipAllow ? 22 : 3,
                  width: 14, height: 14, borderRadius: '50%',
                  background: ipAllow ? 'var(--green)' : 'var(--t3)',
                  transition: 'left 0.2s, background 0.2s',
                }} />
              </button>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
              <Globe size={14} color="var(--mist)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Active Sessions</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t3)' }}>{sessions.length} sessions</span>
            </div>
            {sessions.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: s.current ? 'rgba(201,148,58,0.04)' : 'transparent',
              }}>
                <PulsingDot status={s.current ? 'active' : 'idle'} size={7} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{s.device}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
                    {s.location} · {s.ip} · {s.lastSeen}
                  </div>
                </div>
                {s.current
                  ? <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, background: 'rgba(34,211,160,0.1)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(34,211,160,0.25)' }}>Current</span>
                  : <button
                      className="btn btn-sm btn-ghost"
                      style={{ color: 'var(--red)', borderColor: 'rgba(242,93,93,0.3)' }}
                      onClick={() => revokeSession(s.id)}
                    >
                      Revoke
                    </button>
                }
              </div>
            ))}
            {sessions.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>No active sessions</div>
            )}
          </div>

          {/* Audit Log */}
          <div className="card" style={{ overflow: 'hidden', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
              <Shield size={14} color="var(--amber)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Audit Log</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t3)' }}>Last 7 events</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>User / Source</th>
                  <th>Time</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {AUDIT_LOG.map(e => (
                  <tr key={e.id}>
                    <td style={{ color: 'var(--t1)', fontWeight: 500, fontSize: 12 }}>{e.action}</td>
                    <td style={{ fontSize: 12 }}>{e.user}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{e.time}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 600, color: LEVEL_COLOR[e.level],
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: LEVEL_COLOR[e.level] }} />
                        {e.level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── API KEYS ── */}
      {tab === 'api-keys' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
            <Key size={14} color="var(--mist)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>API Keys & Integrations</span>
            <button
              className="btn btn-sm btn-ghost"
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => setShowAddKey(!showAddKey)}
            >
              {showAddKey ? <X size={12} /> : <Plus size={12} />} {showAddKey ? 'Cancel' : 'Add Key'}
            </button>
          </div>

          {showAddKey && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(201,148,58,0.04)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Service Name</label>
                  <input
                    value={newKey.name}
                    onChange={e => setNewKey(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. OpenAI"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>API Key / Secret</label>
                  <input
                    value={newKey.key}
                    onChange={e => setNewKey(p => ({ ...p, key: e.target.value }))}
                    placeholder="sk-..."
                    type="password"
                    style={{ width: '100%', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Environment</label>
                  <select value={newKey.env} onChange={e => setNewKey(p => ({ ...p, env: e.target.value }))}>
                    <option value="production">production</option>
                    <option value="staging">staging</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--gold)', borderColor: 'rgba(212,146,10,0.40)' }} onClick={addApiKey}>Add Key</button>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Key</th>
                <th>Environment</th>
                <th>Last Used</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map(k => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 500, color: 'var(--t1)', fontSize: 12 }}>{k.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--t2)' }}>
                        {showKey === k.id ? k.key : k.key.replace(/[^•]/g, c => c === '•' ? '•' : c)}
                      </span>
                      <button
                        className="btn-icon"
                        onClick={() => setShowKey(showKey === k.id ? null : k.id)}
                        style={{ padding: 3 }}
                      >
                        {showKey === k.id ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                      background: k.env === 'production' ? 'rgba(201,148,58,0.08)' : 'rgba(245,166,35,0.1)',
                      color: k.env === 'production' ? 'var(--gold)' : 'var(--amber)',
                      border: `1px solid ${k.env === 'production' ? 'rgba(201,148,58,0.25)' : 'rgba(245,166,35,0.25)'}`,
                    }}>
                      {k.env}
                    </span>
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{k.lastUsed}</td>
                  <td><StatusBadge status={k.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn-icon"
                        title="Rotate key"
                        onClick={() => rotateKey(k.id, k.name)}
                      >
                        <RefreshCw size={12} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Delete key"
                        style={{ color: 'var(--red)' }}
                        onClick={() => deleteKey(k.id, k.name)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TEAM ── */}
      {tab === 'team' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
            <Users size={14} color="var(--mist)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Team Members</span>
            <button
              className="btn btn-sm btn-ghost"
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => setShowInvite(!showInvite)}
            >
              {showInvite ? <X size={12} /> : <Plus size={12} />} {showInvite ? 'Cancel' : 'Invite'}
            </button>
          </div>

          {showInvite && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(114,207,168,0.04)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Full Name</label>
                  <input
                    value={invite.name}
                    onChange={e => setInvite(p => ({ ...p, name: e.target.value }))}
                    placeholder="Jane Smith"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Email</label>
                  <input
                    value={invite.email}
                    onChange={e => setInvite(p => ({ ...p, email: e.target.value }))}
                    placeholder="jane@solnestai.com"
                    type="email"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Role</label>
                  <select value={invite.role} onChange={e => setInvite(p => ({ ...p, role: e.target.value }))}>
                    <option value="Admin">Admin</option>
                    <option value="Team Member">Team Member</option>
                    <option value="Client">Client</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--mist)', borderColor: 'rgba(14,143,106,0.40)' }} onClick={inviteMember}>Send Invite</button>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {team.map(u => (
                <tr key={u.id}>
                  <td>
                    {editingMember === u.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          value={editValues.name}
                          onChange={e => setEditValues(p => ({ ...p, name: e.target.value }))}
                          style={{ fontSize: 12, padding: '3px 6px', width: 110 }}
                        />
                        <input
                          value={editValues.email}
                          onChange={e => setEditValues(p => ({ ...p, email: e.target.value }))}
                          style={{ fontSize: 12, padding: '3px 6px', width: 140 }}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: 'rgba(201,148,58,0.1)', border: '1px solid rgba(201,148,58,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: 'var(--mist)', flexShrink: 0,
                        }}>
                          {u.avatar}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--t3)' }}>{u.email}</div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    {editingMember === u.id ? (
                      <select
                        value={editValues.role}
                        onChange={e => setEditValues(p => ({ ...p, role: e.target.value }))}
                        style={{ fontSize: 12, padding: '3px 6px' }}
                      >
                        <option value="Admin">Admin</option>
                        <option value="Team Member">Team Member</option>
                        <option value="Client">Client</option>
                      </select>
                    ) : (
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        color: u.role === 'Admin' ? 'var(--mist)' : u.role === 'Client' ? 'var(--purple)' : 'var(--t2)',
                      }}>
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td><StatusBadge status={u.status} /></td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{u.last}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {editingMember === u.id ? (
                        <>
                          <button
                            className="btn btn-sm btn-ghost"
                            style={{ color: 'var(--sage)', borderColor: 'rgba(26,122,68,0.35)' }}
                            onClick={() => saveEdit(u.id)}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setEditingMember(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => startEdit(u)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-icon"
                            style={{ color: 'var(--red)' }}
                            onClick={() => deleteMember(u.id, u.name)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === 'notifications' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <NotificationToggle title="Revenue alerts"    subtitle="Pricing changes & thresholds" />
          <NotificationToggle title="Agent errors"      subtitle="When any agent hits an error" />
          <NotificationToggle title="New bookings"      subtitle="Confirmed reservation notifications" />
          <NotificationToggle title="Maintenance tasks" subtitle="Upcoming and overdue tasks" />
          <NotificationToggle title="Weekly digest"     subtitle="Every Monday at 9:00 AM" />
          <NotificationToggle title="Guest messages"    subtitle="Unread message alerts" />
        </div>
      )}

      {/* ── SYSTEM ── */}
      {tab === 'system' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Cpu size={14} color="var(--mist)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Services</span>
            </div>
            {[
              { label: 'Revenue Engine (Python)', url: 'http://127.0.0.1:5050', status: 'operational' },
              { label: 'Fastify API Server',      url: 'http://localhost:3001',  status: 'operational' },
              { label: 'Supabase DB',             url: 'Managed',               status: 'operational' },
              { label: 'Redis / BullMQ',          url: 'localhost:6379',         status: 'degraded'    },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <PulsingDot status={s.status as 'operational' | 'degraded'} size={7} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>{s.url}</div>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Database size={14} color="var(--amber)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Data & Storage</span>
            </div>
            {[
              { label: 'GDPR Compliance',       done: true  },
              { label: 'Data encryption at rest', done: true  },
              { label: 'Automated backups',     done: true  },
              { label: 'Data retention policy', done: false },
              { label: 'Right to deletion flow', done: false },
            ].map(i => (
              <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                {i.done
                  ? <CheckCircle size={14} color="var(--green)" />
                  : <AlertTriangle size={14} color="var(--amber)" />
                }
                <span style={{ fontSize: 12, color: i.done ? 'var(--t2)' : 'var(--t1)', fontWeight: i.done ? 400 : 500 }}>
                  {i.label}
                </span>
                {!i.done && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>Action needed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
