import { useState } from 'react'
import { Clock, Mail, CheckCircle, AlertCircle, Archive } from 'lucide-react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { useCountdown } from '../../hooks/useScheduler'
import { EMAIL_TRIAGE } from '../../data/mockData'
import { toast } from '../../store/toastStore'
import type { EmailEntry, EmailCategory, EmailTriageStatus } from '../../types/index'
import clsx from 'clsx'

const categoryColors: Record<EmailCategory, string> = {
  booking: 'var(--green)',
  complaint: 'var(--red)',
  inquiry: 'var(--mist)',
  maintenance: 'var(--amber)',
  review: 'var(--purple)',
  spam: 'var(--t3)',
  urgent: 'var(--red)',
}

const categoryIcons: Record<EmailCategory, string> = {
  booking: '📅', complaint: '⚠️', inquiry: '❓', maintenance: '🔧',
  review: '⭐', spam: '🚫', urgent: '🚨',
}

function EmailRow({
  email, selected, onClick, onTriage, onEscalate, onArchive,
}: {
  email: EmailEntry
  selected: boolean
  onClick: () => void
  onTriage: () => void
  onEscalate: () => void
  onArchive: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer"
      style={{ background: selected ? 'rgba(201,148,58,0.05)' : undefined }}
    >
      <td>
        <span className="text-sm">{categoryIcons[email.category]}</span>
      </td>
      <td>
        <div style={{ color: 'var(--t1)', fontWeight: 500, fontSize: 12 }}>{email.from}</div>
      </td>
      <td>
        <div className="text-xs" style={{ color: 'var(--t1)' }}>{email.subject}</div>
        {email.property && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{email.property}</div>
        )}
      </td>
      <td>
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border"
          style={{ color: categoryColors[email.category], borderColor: `${categoryColors[email.category]}30`, background: `${categoryColors[email.category]}10`, fontSize: 12 }}
        >
          {email.category}
        </span>
      </td>
      <td><StatusBadge status={email.priority} /></td>
      <td><StatusBadge status={email.status} /></td>
      <td className="text-xs" style={{ color: 'var(--t3)' }}>{email.receivedAt}</td>
      <td>
        <div className="flex gap-1">
          <button
            className="p-1 hover:text-green-400"
            style={{ color: email.status === 'triaged' ? 'var(--green)' : 'var(--t3)' }}
            title="Mark Triaged"
            onClick={e => { e.stopPropagation(); onTriage() }}
          >
            <CheckCircle size={12} />
          </button>
          <button
            className="p-1 hover:text-red-400"
            style={{ color: email.status === 'escalated' ? 'var(--red)' : 'var(--t3)' }}
            title="Escalate"
            onClick={e => { e.stopPropagation(); onEscalate() }}
          >
            <AlertCircle size={12} />
          </button>
          <button
            className="p-1 hover:text-slate-400"
            style={{ color: 'var(--t3)' }}
            title="Archive"
            onClick={e => { e.stopPropagation(); onArchive() }}
          >
            <Archive size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export function EmailTriagePage() {
  const countdown = useCountdown('email-triage')
  const [emails, setEmails] = useState<EmailEntry[]>(EMAIL_TRIAGE)
  const [selectedEmail, setSelectedEmail] = useState<EmailEntry | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [triageNote, setTriageNote] = useState('')
  const [overrideCategory, setOverrideCategory] = useState<EmailCategory | ''>('')

  function updateEmailStatus(id: string, status: EmailTriageStatus) {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, status } : e))
    setSelectedEmail(prev => prev?.id === id ? { ...prev, status } : prev)
  }

  function archiveEmail(id: string) {
    setEmails(prev => prev.filter(e => e.id !== id))
    setSelectedEmail(prev => prev?.id === id ? null : prev)
    toast.info('Email archived')
  }

  function handleRunNow() {
    toast.success('Email triage job triggered — processing inbox...')
  }

  function handleMarkTriaged() {
    if (!selectedEmail) return
    if (overrideCategory && overrideCategory !== selectedEmail.category) {
      setEmails(prev => prev.map(e => e.id === selectedEmail.id ? { ...e, status: 'triaged', category: overrideCategory } : e))
      setSelectedEmail(prev => prev ? { ...prev, status: 'triaged', category: overrideCategory } : prev)
    } else {
      updateEmailStatus(selectedEmail.id, 'triaged')
    }
    toast.success(`Marked as triaged${triageNote ? ' with note' : ''}`)
    setTriageNote('')
    setOverrideCategory('')
  }

  function handleEscalate() {
    if (!selectedEmail) return
    updateEmailStatus(selectedEmail.id, 'escalated')
    toast.warning(`Email escalated: ${selectedEmail.subject}`)
    setTriageNote('')
  }

  const stats = {
    total: emails.length,
    triaged: emails.filter(e => e.status === 'triaged' || e.status === 'auto-resolved').length,
    escalated: emails.filter(e => e.status === 'escalated').length,
    autoResolved: emails.filter(e => e.status === 'auto-resolved').length,
  }

  const filtered = filter === 'all' ? emails : emails.filter(e => e.category === filter || e.status === filter)

  return (
    <PageWrapper title="Email Triage" subtitle="AI-powered inbox triage · Automated classification · Escalation routing">
      {/* Next run countdown */}
      <div
        className="flex items-center gap-4 p-4 rounded-lg mb-5"
        style={{ background: 'rgba(201,148,58,0.06)', border: '1px solid rgba(201,148,58,0.18)' }}
      >
        <div className="flex items-center gap-2">
          <Clock size={16} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>Next Triage Run</span>
        </div>
        <div className="metric-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>{countdown}</div>
        <span className="text-sm" style={{ color: 'var(--t3)' }}>— runs every 5 minutes automatically</span>
        <button className="btn btn-primary ml-auto flex items-center gap-1.5" onClick={handleRunNow}>
          <Mail size={14} /> Run Now
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Emails', value: stats.total, color: 'var(--t2)', icon: <Mail size={16} /> },
          { label: 'Triaged Today', value: stats.triaged, color: 'var(--green)', icon: <CheckCircle size={16} /> },
          { label: 'Escalated', value: stats.escalated, color: 'var(--red)', icon: <AlertCircle size={16} /> },
          { label: 'Auto-Resolved', value: stats.autoResolved, color: 'var(--mist)', icon: <Archive size={16} /> },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <span style={{ color: s.color }}>{s.icon}</span>
            <div>
              <div className="metric-value" style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div className="text-xs" style={{ color: 'var(--t3)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Row */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'pending', 'escalated', 'booking', 'complaint', 'urgent', 'maintenance', 'inquiry'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx('text-xs px-3 py-1.5 rounded capitalize transition-all', filter === f ? 'font-semibold' : 'opacity-60')}
            style={{
              background: filter === f ? 'rgba(212,146,10,0.10)' : 'transparent',
              border: `1px solid ${filter === f ? 'rgba(212,146,10,0.45)' : 'rgba(10,10,9,0.14)'}`,
              color: filter === f ? 'var(--gold)' : 'var(--t2)',
            }}
          >
            {f}
          </button>
        ))}
        <span className="text-xs ml-auto self-center" style={{ color: 'var(--t3)' }}>
          {filtered.length} results
        </span>
      </div>

      {/* Email Table */}
      <div className="card overflow-hidden mb-5">
        <div className="overflow-auto" style={{ maxHeight: 380 }}>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>From</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Received</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(email => (
                <EmailRow
                  key={email.id}
                  email={email}
                  selected={selectedEmail?.id === email.id}
                  onClick={() => {
                    setSelectedEmail(email)
                    setOverrideCategory(email.category)
                    setTriageNote('')
                  }}
                  onTriage={() => {
                    updateEmailStatus(email.id, 'triaged')
                    toast.success('Email marked as triaged')
                  }}
                  onEscalate={() => {
                    updateEmailStatus(email.id, 'escalated')
                    toast.warning(`Escalated: ${email.subject}`)
                  }}
                  onArchive={() => archiveEmail(email.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Triage Panel */}
      <div className="card p-4">
        <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--t3)', marginBottom: 12 }}>
          Manual Triage Panel
        </h3>
        {selectedEmail ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--t1)' }}>{selectedEmail.subject}</div>
              <div className="text-xs mb-2" style={{ color: 'var(--t3)' }}>From: {selectedEmail.from} · {selectedEmail.receivedAt}</div>
              <p className="text-xs leading-relaxed p-3 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--t2)', minHeight: 80 }}>
                [Email content would load here from the inbox API. This email has been classified as: <strong style={{ color: categoryColors[selectedEmail.category] }}>{selectedEmail.category}</strong>]
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Override Category</label>
                <select
                  className="w-full"
                  value={overrideCategory || selectedEmail.category}
                  onChange={e => setOverrideCategory(e.target.value as EmailCategory)}
                >
                  {(['booking', 'complaint', 'inquiry', 'maintenance', 'review', 'spam', 'urgent'] as EmailCategory[]).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Triage Note</label>
                <textarea
                  rows={2}
                  placeholder="Add a note for this email..."
                  className="w-full resize-none"
                  value={triageNote}
                  onChange={e => setTriageNote(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm btn-ghost flex items-center gap-1"
                  style={{ color: 'var(--sage)', borderColor: 'rgba(26,122,68,0.35)' }}
                  onClick={handleMarkTriaged}
                >
                  <CheckCircle size={12} /> Mark Triaged
                </button>
                <button
                  className="btn btn-sm btn-ghost flex items-center gap-1"
                  style={{ color: 'var(--red)', borderColor: 'rgba(214,48,49,0.30)' }}
                  onClick={handleEscalate}
                >
                  <AlertCircle size={12} /> Escalate
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-xs" style={{ color: 'var(--t3)' }}>
            Select an email from the table above to triage it manually
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
