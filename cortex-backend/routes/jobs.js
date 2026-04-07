/**
 * routes/jobs.js
 * GET  /api/jobs       — list all scheduled jobs
 * POST /api/jobs       — create a new job or toggle existing
 * PATCH /api/jobs/:id  — update job (status, cron, etc.)
 * DELETE /api/jobs/:id — remove a job
 */

import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import cron from 'node-cron'

const router = Router()

// ─── In-memory job registry ───────────────────────────────────────────────────

function nextRunFromCron(cronExpr) {
  // Simple human-readable next-run estimation (not a full cron parser)
  try {
    const parts = cronExpr.split(' ')
    // Return current time + 1h as rough approximation
    const next = new Date(Date.now() + 3600000)
    return next.toISOString()
  } catch {
    return new Date(Date.now() + 3600000).toISOString()
  }
}

function minsAgo(n) {
  return new Date(Date.now() - n * 60000).toISOString()
}

/** @type {Map<string, object>} */
const jobStore = new Map()

/** @type {Map<string, import('node-cron').ScheduledTask>} */
const cronTasks = new Map()

const INITIAL_JOBS = [
  {
    id: 'j1',
    name: 'Revenue Pricing Sync',
    cron: '*/15 * * * *',
    nextRun: nextRunFromCron('*/15 * * * *'),
    lastRun: minsAgo(4),
    status: 'active',
    agent: 'a1',
    agentName: 'Revenue Agent',
    description: 'Run pricing analysis and apply dynamic rate rules across all properties',
    runCount: 94,
  },
  {
    id: 'j2',
    name: 'Guest Message Monitor',
    cron: '*/5 * * * *',
    nextRun: nextRunFromCron('*/5 * * * *'),
    lastRun: minsAgo(2),
    status: 'active',
    agent: 'a2',
    agentName: 'Guest Agent',
    description: 'Check Hospitable for unanswered messages and dispatch AI replies',
    runCount: 241,
  },
  {
    id: 'j3',
    name: 'Operations Turnover Check',
    cron: '0 8 * * *',
    nextRun: nextRunFromCron('0 8 * * *'),
    lastRun: minsAgo(480),
    status: 'active',
    agent: 'a3',
    agentName: 'Operations Agent',
    description: 'Scan upcoming checkouts and schedule cleaning crews for same-day turnovers',
    runCount: 31,
  },
  {
    id: 'j4',
    name: 'Weekly Analytics Report',
    cron: '0 9 * * 1',
    nextRun: nextRunFromCron('0 9 * * 1'),
    lastRun: minsAgo(45),
    status: 'active',
    agent: 'a4',
    agentName: 'Analytics Agent',
    description: 'Generate weekly revenue, occupancy, and market intelligence report',
    runCount: 12,
  },
  {
    id: 'j5',
    name: 'Listing Score Audit',
    cron: '0 10 * * 3',
    nextRun: nextRunFromCron('0 10 * * 3'),
    lastRun: minsAgo(18),
    status: 'paused',
    agent: 'a5',
    agentName: 'Marketing Agent',
    description: 'Audit listing quality scores and trigger rewrite for properties below threshold',
    runCount: 9,
  },
  {
    id: 'j6',
    name: 'CORTEX Orchestration Cycle',
    cron: '0 */4 * * *',
    nextRun: nextRunFromCron('0 */4 * * *'),
    lastRun: minsAgo(60),
    status: 'active',
    agent: 'cortex',
    agentName: 'CORTEX Orchestrator',
    description: 'Full portfolio coordination: assess all agents, prioritise actions, emit directives',
    runCount: 18,
  },
]

for (const job of INITIAL_JOBS) {
  jobStore.set(job.id, job)
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/jobs
router.get('/', (_req, res) => {
  const jobs = [...jobStore.values()]
  jobs.sort((a, b) => a.name.localeCompare(b.name))
  res.json({ jobs })
})

// POST /api/jobs — create a new job
router.post('/', (req, res) => {
  const { name, cron: cronExpr, agent, agentName, description, status = 'active' } = req.body

  if (!name || !cronExpr || !agent) {
    return res.status(400).json({ error: 'name, cron, and agent are required' })
  }

  if (!cron.validate(cronExpr)) {
    return res.status(400).json({ error: `Invalid cron expression: ${cronExpr}` })
  }

  const id = `j-${uuid().slice(0, 8)}`
  const job = {
    id,
    name,
    cron: cronExpr,
    nextRun: nextRunFromCron(cronExpr),
    lastRun: null,
    status,
    agent,
    agentName: agentName ?? agent,
    description: description ?? '',
    runCount: 0,
  }

  jobStore.set(id, job)
  res.status(201).json({ job })
})

// PATCH /api/jobs/:id — update job fields
router.patch('/:id', (req, res) => {
  const job = jobStore.get(req.params.id)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  const { status, cron: cronExpr, name, description } = req.body
  const updates = {}

  if (status && ['active', 'paused', 'error'].includes(status)) updates.status = status
  if (name) updates.name = name
  if (description) updates.description = description
  if (cronExpr) {
    if (!cron.validate(cronExpr)) {
      return res.status(400).json({ error: `Invalid cron expression: ${cronExpr}` })
    }
    updates.cron = cronExpr
    updates.nextRun = nextRunFromCron(cronExpr)
  }

  const updated = { ...job, ...updates }
  jobStore.set(req.params.id, updated)
  res.json({ job: updated })
})

// DELETE /api/jobs/:id
router.delete('/:id', (req, res) => {
  if (!jobStore.has(req.params.id)) return res.status(404).json({ error: 'Job not found' })
  // Stop cron task if running
  const task = cronTasks.get(req.params.id)
  if (task) { task.stop(); cronTasks.delete(req.params.id) }
  jobStore.delete(req.params.id)
  res.json({ ok: true })
})

export default router
