/**
 * routes/agents.js
 * GET  /api/agents          — list all agents
 * PATCH /api/agents/:id     — toggle status (active ↔ idle)
 * POST  /api/agents/:id/run — invoke agent, stream output via Socket.io
 */

import { Router } from 'express'
import { getAllAgents, getAgentById, updateAgent } from '../lib/agentState.js'
import { runAgent } from '../lib/agentRunner.js'

const router = Router()

// GET /api/agents
router.get('/', (_req, res) => {
  res.json({ agents: getAllAgents() })
})

// GET /api/agents/:id
router.get('/:id', (req, res) => {
  const agent = getAgentById(req.params.id)
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  // Return sanitised agent (no systemPrompt)
  const { systemPrompt: _sp, ...safe } = agent
  res.json({ agent: safe })
})

// PATCH /api/agents/:id  — toggle active/idle or set explicit status
router.patch('/:id', (req, res) => {
  const agent = getAgentById(req.params.id)
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  const { status } = req.body
  const allowed = ['active', 'idle', 'error', 'warning']

  let newStatus
  if (status && allowed.includes(status)) {
    newStatus = status
  } else {
    // Toggle active ↔ idle
    newStatus = agent.status === 'active' ? 'idle' : 'active'
  }

  const updated = updateAgent(req.params.id, { status: newStatus })
  res.json({ agent: updated })
})

// POST /api/agents/:id/run — invoke agent, stream via socket
router.post('/:id/run', async (req, res) => {
  const { id } = req.params
  const agent = getAgentById(id)
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  const { prompt, socketId } = req.body

  // Get the io instance injected onto app
  const io = req.app.get('io')
  let targetSocket = null
  if (socketId && io) {
    targetSocket = io.sockets.sockets.get(socketId) ?? null
  }

  // Respond immediately; streaming happens over Socket.io
  res.json({ ok: true, agentId: id, message: 'Agent run started — follow via socket events' })

  // Run async (don't await)
  runAgent(id, prompt ?? null, targetSocket).catch((err) => {
    console.error(`[agents route] runAgent(${id}) unhandled:`, err.message)
  })
})

export default router
