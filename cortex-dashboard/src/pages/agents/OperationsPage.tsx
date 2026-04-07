import { useState, useRef } from 'react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { AgentCard } from '../../components/shared/AgentCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { useSystemStore } from '../../store/systemStore'
import { KANBAN_TASKS } from '../../data/mockData'
import { toast } from '../../store/toastStore'
import { Plus, X } from 'lucide-react'
import type { KanbanTask, KanbanColumn } from '../../types/index'

const priorityColors: Record<string, string> = {
  urgent: '#D63031',
  high:   '#C9501A',
  medium: '#D4920A',
  low:    '#6B6B62',
}

const COLUMNS: { col: KanbanColumn; title: string; accent: string }[] = [
  { col: 'todo',        title: 'To Do',      accent: '#6B6B62' },
  { col: 'in-progress', title: 'In Progress', accent: '#0E8F6A' },
  { col: 'done',        title: 'Done',        accent: '#1A7A44' },
]

export function OperationsPage() {
  const agents   = useSystemStore(s => s.agents)
  const opsAgent = agents.find(a => a.id === 'a3')!

  const [tasks, setTasks]           = useState<KanbanTask[]>([...KANBAN_TASKS])
  const [addingCol, setAddingCol]   = useState<KanbanColumn | null>(null)
  const [newTitle, setNewTitle]     = useState('')
  const [newPriority, setNewPriority] = useState<KanbanTask['priority']>('medium')
  const [newProperty, setNewProperty] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [dragOverCol, setDragOverCol] = useState<KanbanColumn | null>(null)

  // Use a ref for dragging ID so we don't re-render mid-drag
  const draggingId = useRef<string | null>(null)

  function openAddForm(col: KanbanColumn) {
    setAddingCol(col)
    setNewTitle('')
    setNewPriority('medium')
    setNewProperty('')
    setNewAssignee('')
  }

  function submitTask() {
    if (!newTitle.trim()) { toast.error('Title is required'); return }
    const task: KanbanTask = {
      id:         `task-${Date.now()}`,
      title:      newTitle.trim(),
      property:   newProperty.trim() || 'General',
      assignedTo: newAssignee.trim() || 'Unassigned',
      dueDate:    new Date(Date.now() + 3 * 86400000)
        .toLocaleDateString('en-CA', { month: 'short', day: '2-digit' }),
      priority: newPriority,
      column:   addingCol!,
      tags:     [],
    }
    setTasks(prev => [...prev, task])
    setAddingCol(null)
    toast.success('Task added')
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    draggingId.current = id
    e.dataTransfer.effectAllowed = 'move'
    // Slight delay so the browser renders the drag image before we hide the element
    setTimeout(() => {
      const el = document.getElementById(`task-${id}`)
      if (el) el.style.opacity = '0.35'
    }, 0)
  }

  function handleDragEnd(id: string) {
    draggingId.current = null
    setDragOverCol(null)
    const el = document.getElementById(`task-${id}`)
    if (el) el.style.opacity = '1'
  }

  function handleDragOver(e: React.DragEvent, col: KanbanColumn) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(col)
  }

  function handleDrop(e: React.DragEvent, col: KanbanColumn) {
    e.preventDefault()
    const id = draggingId.current
    if (!id) return
    setTasks(prev => {
      const task = prev.find(t => t.id === id)
      if (!task || task.column === col) return prev
      toast.success(`Moved to ${COLUMNS.find(c => c.col === col)?.title}`)
      return prev.map(t => t.id === id ? { ...t, column: col } : t)
    })
    draggingId.current = null
    setDragOverCol(null)
  }

  const stats = {
    urgent:     tasks.filter(t => t.priority === 'urgent').length,
    inProgress: tasks.filter(t => t.column === 'in-progress').length,
    done:       tasks.filter(t => t.column === 'done').length,
    total:      tasks.length,
  }

  return (
    <PageWrapper title="Operations Agent" subtitle="Task management · Maintenance dispatch · Cleaning schedules">
      <div className="flex gap-5 mb-5">

        {/* Sidebar */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <AgentCard agent={opsAgent} />
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              { label: 'Urgent',      value: stats.urgent,             color: 'var(--red)'   },
              { label: 'In Progress', value: stats.inProgress,         color: 'var(--mist)'  },
              { label: 'Done Today',  value: stats.done,               color: 'var(--sage)'  },
              { label: 'Total Open',  value: stats.total - stats.done, color: 'var(--amber)' },
            ].map(s => (
              <div key={s.label} className="card p-3 text-center">
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Kanban Board */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {COLUMNS.map(({ col, title, accent }) => {
            const colTasks = tasks.filter(t => t.column === col)
            const isOver   = dragOverCol === col

            return (
              <div
                key={col}
                style={{ display: 'flex', flexDirection: 'column', minHeight: 500 }}
                onDragOver={e => handleDragOver(e, col)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => handleDrop(e, col)}
              >
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: '8px 8px 0 0', marginBottom: 8,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{title}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: accent }}>{colTasks.length}</span>
                </div>

                {/* Drop zone */}
                <div style={{
                  flex: 1,
                  borderRadius: 8,
                  border: isOver ? `2px dashed ${accent}` : '2px solid transparent',
                  background: isOver ? `${accent}0A` : 'transparent',
                  padding: 4,
                  transition: 'border-color 0.15s, background 0.15s',
                  minHeight: 80,
                }}>
                  {/* Task cards */}
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      id={`task-${task.id}`}
                      draggable
                      onDragStart={e => handleDragStart(e, task.id)}
                      onDragEnd={() => handleDragEnd(task.id)}
                      className="card p-3 mb-2"
                      style={{
                        borderLeft: `3px solid ${priorityColors[task.priority]}`,
                        cursor: 'grab',
                        userSelect: 'none',
                        transition: 'opacity 0.15s, box-shadow 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--t1)' }}>{task.title}</span>
                        <StatusBadge status={task.priority} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.property}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--t3)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.assignedTo}</span>
                        <span style={{ flexShrink: 0, marginLeft: 4, color: task.priority === 'urgent' ? 'var(--red)' : 'var(--t3)' }}>
                          {task.dueDate}
                        </span>
                      </div>
                      {task.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                          {task.tags.map(tag => (
                            <span key={tag} style={{
                              fontSize: 11, padding: '2px 7px', borderRadius: 10,
                              background: 'rgba(10,10,9,0.06)',
                              border: '1px solid rgba(10,10,9,0.10)',
                              color: 'var(--t3)',
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add task inline form */}
                  {addingCol === col ? (
                    <div className="card p-3 mb-2" style={{ borderLeft: `3px solid ${priorityColors[newPriority]}` }}>
                      <input
                        autoFocus
                        placeholder="Task title..."
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitTask(); if (e.key === 'Escape') setAddingCol(null) }}
                        style={{ fontSize: 13, marginBottom: 8 }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                        <input
                          placeholder="Property"
                          value={newProperty}
                          onChange={e => setNewProperty(e.target.value)}
                          style={{ fontSize: 12 }}
                        />
                        <input
                          placeholder="Assignee"
                          value={newAssignee}
                          onChange={e => setNewAssignee(e.target.value)}
                          style={{ fontSize: 12 }}
                        />
                      </div>
                      <select
                        value={newPriority}
                        onChange={e => setNewPriority(e.target.value as KanbanTask['priority'])}
                        style={{ fontSize: 12, marginBottom: 10 }}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{ color: 'var(--sage)', borderColor: 'rgba(26,122,68,0.35)', flex: 1 }}
                          onClick={submitTask}
                        >
                          Add task
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => setAddingCol(null)}
                          style={{ padding: '6px 10px' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      style={{
                        width: '100%', marginTop: 4, fontSize: 12,
                        color: 'var(--t3)', borderStyle: 'dashed',
                        justifyContent: 'center', gap: 6,
                      }}
                      onClick={() => openAddForm(col)}
                    >
                      <Plus size={12} /> Add task
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PageWrapper>
  )
}
