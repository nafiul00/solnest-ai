import { useState } from 'react'
import { Send, Sparkles, Edit2, Save } from 'lucide-react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { AgentCard } from '../../components/shared/AgentCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { useSystemStore } from '../../store/systemStore'
import { GUESTS, RESPONSE_TEMPLATES } from '../../data/mockData'
import type { Guest } from '../../types/index'
import clsx from 'clsx'

const roleColors = { guest: 'var(--t2)', host: 'var(--gold)', ai: 'var(--green)' }
const roleLabel = { guest: 'Guest', host: 'Host', ai: 'AI' }

export function GuestPage() {
  const agents = useSystemStore(s => s.agents)
  const guestAgent = agents.find(a => a.id === 'a2')!
  const [selectedGuest, setSelectedGuest] = useState<Guest>(GUESTS[0])
  const [compose, setCompose] = useState('')
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [templates, setTemplates] = useState(RESPONSE_TEMPLATES)

  const handleAiAssist = () => {
    setCompose("Thank you for reaching out! I completely understand your concern. Our team has been notified and we'll have this sorted for you right away. Is there anything else I can help you with in the meantime?")
  }

  return (
    <PageWrapper title="Guest Agent" subtitle="AI-powered guest communications · inbox management · response automation">
      <div className="grid grid-cols-4 gap-5">
        {/* Left: Inbox list */}
        <div className="col-span-1 flex flex-col gap-3">
          <AgentCard agent={guestAgent} compact />
          <div className="card overflow-hidden">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t3)' }}>Conversations</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
              {GUESTS.slice(0, 12).map(guest => (
                <div
                  key={guest.id}
                  className={clsx(
                    'flex items-start gap-2.5 px-3 py-3 cursor-pointer transition-all',
                    selectedGuest.id === guest.id ? 'bg-cyan-500/8' : 'hover:bg-white/3'
                  )}
                  style={{ borderBottom: '1px solid rgba(201,148,58,0.1)', borderLeft: selectedGuest.id === guest.id ? '2px solid var(--gold)' : '2px solid transparent' }}
                  onClick={() => setSelectedGuest(guest)}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: 'rgba(201,148,58,0.12)', color: 'var(--gold)' }}>
                    {guest.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guest.name}</span>
                      {guest.unreadCount > 0 && (
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--gold)', color: '#080C10', fontSize: 12 }}>
                          {guest.unreadCount}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guest.propertyName.split(' ').slice(0, 2).join(' ')}</div>
                    <div className="text-xs truncate mt-0.5" style={{ color: 'var(--t2)', fontSize: 12 }}>
                      {guest.messages[guest.messages.length - 1]?.content.slice(0, 45)}...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Conversation thread */}
        <div className="col-span-2 flex flex-col gap-3">
          {/* Thread header */}
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold" style={{ background: 'rgba(201,148,58,0.15)', color: 'var(--gold)' }}>
              {selectedGuest.avatar}
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>{selectedGuest.name}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{selectedGuest.propertyName} · Check-in: {selectedGuest.checkIn} → {selectedGuest.checkOut}</div>
            </div>
            <StatusBadge status={selectedGuest.status === 'active' ? 'active' : selectedGuest.status === 'upcoming' ? 'pending' : 'idle'} label={selectedGuest.status} />
            {selectedGuest.rating && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>★ {selectedGuest.rating}</span>}
          </div>

          {/* Messages */}
          <div className="card overflow-y-auto flex flex-col gap-0" style={{ maxHeight: 340 }}>
            <div className="p-3 flex flex-col gap-3">
              {selectedGuest.messages.map(msg => (
                <div key={msg.id} className={clsx('flex', msg.role !== 'guest' ? 'justify-end' : 'justify-start')}>
                  <div
                    className="max-w-xs rounded-xl px-3 py-2"
                    style={{
                      background: msg.role === 'guest' ? 'rgba(201,148,58,0.05)' : msg.role === 'ai' ? 'rgba(16,185,129,0.1)' : 'rgba(201,148,58,0.12)',
                      border: `1px solid ${roleColors[msg.role]}20`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: 12, fontWeight: 600, color: roleColors[msg.role] }}>{roleLabel[msg.role]}</span>
                      <span style={{ fontSize: 12, color: 'var(--t3)' }}>{msg.timestamp}</span>
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--t2)' }}>{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compose */}
          <div className="card p-3">
            <textarea
              value={compose}
              onChange={e => setCompose(e.target.value)}
              placeholder="Type your reply or use AI Assist..."
              rows={3}
              className="w-full resize-none mb-2"
            />
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost flex items-center gap-1.5" style={{ fontSize: 13 }} onClick={handleAiAssist}>
                <Sparkles size={12} style={{ color: 'var(--green)' }} /> AI Assist
              </button>
              <button
                className="btn btn-primary flex items-center gap-1.5 ml-auto"
                disabled={!compose.trim()}
                onClick={() => {
                  if (!compose.trim()) return
                  setSelectedGuest(g => ({
                    ...g,
                    messages: [...(g.messages ?? []), {
                      id: `m-${Date.now()}`,
                      role: 'host' as const,
                      content: compose.trim(),
                      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    }],
                  }))
                  setCompose('')
                }}
              >
                <Send size={12} /> Send Reply
              </button>
            </div>
          </div>
        </div>

        {/* Right: Templates */}
        <div className="col-span-1">
          <div className="card overflow-hidden">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t3)' }}>Response Templates</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
              {templates.map(t => (
                <div key={t.id} className="p-3" style={{ borderBottom: '1px solid rgba(201,148,58,0.08)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{t.name}</span>
                    <button
                      className="p-1 hover:text-cyan-400"
                      style={{ color: 'var(--t3)' }}
                      onClick={() => setEditingTemplate(editingTemplate === t.id ? null : t.id)}
                    >
                      {editingTemplate === t.id ? <Save size={10} /> : <Edit2 size={10} />}
                    </button>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded mb-2 inline-block" style={{ background: 'rgba(201,148,58,0.08)', color: 'var(--gold)', fontSize: 12 }}>
                    {t.category}
                  </span>
                  {editingTemplate === t.id ? (
                    <textarea
                      value={t.content}
                      onChange={e => setTemplates(prev => prev.map(tp => tp.id === t.id ? { ...tp, content: e.target.value } : tp))}
                      rows={4}
                      className="w-full text-xs resize-none mt-1"
                      style={{ fontSize: 12 }}
                    />
                  ) : (
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--t2)', fontSize: 12 }}>
                      {t.content.slice(0, 120)}...
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs" style={{ color: 'var(--t3)', fontSize: 12 }}>Used {t.usageCount}x</span>
                    <button
                      className="text-xs hover:text-amber-400"
                      style={{ color: 'var(--gold)', fontSize: 12 }}
                      onClick={() => setCompose(t.content)}
                    >
                      Use
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
