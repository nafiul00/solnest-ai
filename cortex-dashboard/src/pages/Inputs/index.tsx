import { useState } from 'react'
import { Plus, Trash2, Play, Pause, X } from 'lucide-react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PulsingDot } from '../../components/shared/PulsingDot'
import { useSchedulerStore } from '../../store/schedulerStore'
import { WHATSAPP_CONTACTS, SLACK_CHANNELS } from '../../data/mockData'
import { useCountdown } from '../../hooks/useScheduler'
import { toast } from '../../store/toastStore'
import type { WhatsAppContact } from '../../types/index'

function JobCountdown({ job }: { job: { name: string; nextRun: string; status: string } }) {
  const countdown = useCountdown(job.name === 'Email Triage' ? 'email-triage' : job.nextRun)
  return <span className="metric-value" style={{ color: job.status === 'paused' ? 'var(--t3)' : 'var(--gold)' }}>{job.status === 'paused' ? '—' : countdown}</span>
}

export function InputsPage() {
  const { jobs, toggleJobStatus, deleteJob, addJob } = useSchedulerStore()
  const [showAddJob, setShowAddJob] = useState(false)
  const [newJob, setNewJob] = useState({ name: '', cron: '', agent: 'CORTEX Orchestrator', description: '' })

  // WhatsApp contacts state
  const [contacts, setContacts] = useState<WhatsAppContact[]>(WHATSAPP_CONTACTS)
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', phone: '' })

  function handleAddContact() {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      toast.error('Name and phone number are required')
      return
    }
    setContacts(prev => [...prev, {
      id: `wc-${Date.now()}`,
      name: newContact.name,
      phone: newContact.phone,
      status: 'allowed',
      lastMessage: 'Added to allowlist',
      messageCount: 0,
    }])
    toast.success(`${newContact.name} added to allowlist`)
    setNewContact({ name: '', phone: '' })
    setShowAddContact(false)
  }

  function handleCreateJob() {
    if (!newJob.name.trim() || !newJob.cron.trim()) {
      toast.error('Job name and cron expression are required')
      return
    }
    addJob({
      id: `j-${Date.now()}`,
      name: newJob.name,
      cron: newJob.cron,
      agent: newJob.agent,
      description: newJob.description || `Automated job: ${newJob.name}`,
      nextRun: '5m',
      lastRun: 'Never',
      status: 'active',
      runCount: 0,
    })
    toast.success(`Job "${newJob.name}" created`)
    setNewJob({ name: '', cron: '', agent: 'CORTEX Orchestrator', description: '' })
    setShowAddJob(false)
  }

  function handleDeleteJob(id: string, name: string) {
    deleteJob(id)
    toast.warning(`Job "${name}" deleted`)
  }

  function handleToggleJob(id: string, currentStatus: string) {
    toggleJobStatus(id)
    toast.info(currentStatus === 'active' ? 'Job paused' : 'Job resumed')
  }

  return (
    <PageWrapper title="Inputs & Automation" subtitle="WhatsApp · Slack · Scheduler configuration">
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* WhatsApp */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#25D36615', border: '1px solid #25D36630' }}>
              <span className="text-sm">💬</span>
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>WhatsApp Input</h3>
              <p className="text-xs" style={{ color: 'var(--t3)' }}>Business API · +1 604-555-CORTEX</p>
            </div>
            <PulsingDot status="active" size={7} />
          </div>

          {showAddContact && (
            <div className="mb-3 p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-hi)' }}>
              <div className="flex gap-2 mb-2">
                <input
                  value={newContact.name}
                  onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                  placeholder="Contact name"
                  style={{ flex: 1, fontSize: 12 }}
                />
                <input
                  value={newContact.phone}
                  onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 604-555-0000"
                  style={{ flex: 1, fontSize: 12 }}
                />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--sage)', borderColor: 'rgba(26,122,68,0.35)' }} onClick={handleAddContact}>Add</button>
                <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => setShowAddContact(false)}>
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-auto" style={{ maxHeight: 280 }}>
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Messages</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--t1)', fontWeight: 500 }}>{c.name}</td>
                    <td className="metric-value text-xs">{c.phone}</td>
                    <td>
                      <StatusBadge status={c.status === 'allowed' ? 'active' : 'error'} label={c.status} />
                    </td>
                    <td>{c.messageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="btn btn-ghost w-full mt-3 flex items-center justify-center gap-2 text-xs"
            onClick={() => setShowAddContact(!showAddContact)}
          >
            <Plus size={12} /> Add Contact to Allowlist
          </button>
        </div>

        {/* Slack */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#4A154B15', border: '1px solid #4A154B30' }}>
              <span className="text-sm">#</span>
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>Slack Integration</h3>
              <p className="text-xs" style={{ color: 'var(--t3)' }}>Workspace: solnest-ai.slack.com</p>
            </div>
            <PulsingDot status="active" size={7} />
          </div>
          <div className="space-y-2">
            {SLACK_CHANNELS.map(ch => (
              <div
                key={ch.id}
                className="flex items-center gap-3 p-2.5 rounded"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <PulsingDot status={ch.connected ? 'active' : 'idle'} size={7} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>{ch.name}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--t3)' }}>{ch.purpose}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs" style={{ color: 'var(--t3)' }}>{ch.memberCount} members</div>
                  <div className="text-xs" style={{ color: 'var(--t3)' }}>{ch.lastActivity}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scheduler */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>Scheduled Jobs</h3>
          <button className="btn btn-ghost flex items-center gap-1.5 text-xs" onClick={() => setShowAddJob(!showAddJob)}>
            {showAddJob ? <X size={12} /> : <Plus size={12} />} {showAddJob ? 'Cancel' : 'Add Job'}
          </button>
        </div>

        {showAddJob && (
          <div className="p-4 rounded-lg mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-hi)' }}>
            <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--gold)' }}>New Scheduled Job</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Job Name</label>
                <input value={newJob.name} onChange={e => setNewJob(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Daily Price Check" className="w-full" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Cron Expression</label>
                <input value={newJob.cron} onChange={e => setNewJob(p => ({ ...p, cron: e.target.value }))} placeholder="e.g. 0 9 * * *" className="w-full font-mono" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Agent</label>
                <select value={newJob.agent} onChange={e => setNewJob(p => ({ ...p, agent: e.target.value }))} className="w-full">
                  <option>CORTEX Orchestrator</option>
                  <option>Revenue Agent</option>
                  <option>Guest Agent</option>
                  <option>Operations Agent</option>
                  <option>Analytics Agent</option>
                  <option>Marketing Agent</option>
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Description</label>
                <input value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))} placeholder="What does this job do?" className="w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--gold)', borderColor: 'rgba(212,146,10,0.40)' }} onClick={handleCreateJob}>Create Job</button>
              <button className="btn btn-ghost text-xs" onClick={() => setShowAddJob(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="overflow-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Cron</th>
                <th>Agent</th>
                <th>Next Run</th>
                <th>Last Run</th>
                <th>Runs</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td>
                    <div style={{ color: 'var(--t1)', fontWeight: 500 }}>{job.name}</div>
                    <div style={{ color: 'var(--t3)', fontSize: 12 }}>{job.description.slice(0, 60)}...</div>
                  </td>
                  <td className="metric-value text-xs" style={{ color: 'var(--gold)' }}>{job.cron}</td>
                  <td className="text-xs">{job.agent}</td>
                  <td><JobCountdown job={job} /></td>
                  <td className="text-xs" style={{ color: 'var(--t3)' }}>{job.lastRun}</td>
                  <td className="metric-value">{job.runCount.toLocaleString()}</td>
                  <td><StatusBadge status={job.status} /></td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleToggleJob(job.id, job.status)}
                        className="p-1.5 rounded hover:bg-white/5"
                        title={job.status === 'active' ? 'Pause' : 'Resume'}
                      >
                        {job.status === 'active'
                          ? <Pause size={12} style={{ color: 'var(--amber)' }} />
                          : <Play size={12} style={{ color: 'var(--green)' }} />
                        }
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id, job.name)}
                        className="p-1.5 rounded hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 size={12} style={{ color: 'var(--red)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  )
}
