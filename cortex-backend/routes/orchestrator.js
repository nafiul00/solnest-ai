/**
 * routes/orchestrator.js
 * POST /api/orchestrator/run — trigger CORTEX cycle, stream via Socket.io
 */

import { Router } from 'express'
import { runOrchestrator } from '../lib/agentRunner.js'

const router = Router()

// POST /api/orchestrator/run
router.post('/run', async (req, res) => {
  const io = req.app.get('io')
  const { socketId } = req.body

  let targetSocket = null
  if (socketId && io) {
    targetSocket = io.sockets.sockets.get(socketId) ?? null
  }

  // Acknowledge immediately; stream over socket
  res.json({ ok: true, message: 'CORTEX cycle started — follow via socket events (agent:stream:*)' })

  runOrchestrator(targetSocket).catch((err) => {
    console.error('[orchestrator route] unhandled:', err.message)
  })
})

export default router
