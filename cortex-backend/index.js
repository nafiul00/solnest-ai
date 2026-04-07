/**
 * cortex-backend/index.js
 * Main Express + Socket.io server for the Solnest AI CORTEX dashboard.
 *
 * Port: 3001  (doesn't conflict with guest-agent on 3000)
 * CORS: http://localhost:5173 (Vite dev) + http://localhost:4173 (preview)
 *
 * Socket.io events emitted to the dashboard:
 *   agent:update        — agent status / lastAction changed
 *   activity:new        — new activity feed entry
 *   metric:update       — KPI metric tick (every 30 s)
 *   agent:stream:start  — agent run started   { agentId, runId, agentName }
 *   agent:stream:chunk  — streamed token      { agentId, runId, text }
 *   agent:stream:end    — run complete        { agentId, runId, durationMs, status }
 */

import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Load from parent dir (.env lives next to cortex-dashboard, guest-agent, etc.)
loadEnv({ path: resolve(__dirname, '..', '.env') })
// Also allow a local override
loadEnv({ path: resolve(__dirname, '.env') })

import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { Server as SocketIo } from 'socket.io'

import { setIo as setAgentIo,    getAllAgents }           from './lib/agentState.js'
import { setIo as setActivityIo, addEntry, getEntries }  from './lib/activityLog.js'
import { setIo as setRunnerIo }                          from './lib/agentRunner.js'

import agentsRouter      from './routes/agents.js'
import propertiesRouter  from './routes/properties.js'
import emailsRouter      from './routes/emails.js'
import jobsRouter        from './routes/jobs.js'
import orchRouter        from './routes/orchestrator.js'

const PORT             = parseInt(process.env.PORT ?? '3001', 10)
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY ?? null

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]

// ─── Express + HTTP server ────────────────────────────────────────────────────
const app        = express()
const httpServer = createServer(app)

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new SocketIo(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  },
})

// Socket.io auth — validate token on handshake
io.use((socket, next) => {
  const token = socket.handshake.auth?.token ?? ''
  const bearer = token.startsWith('Bearer ') ? token.slice(7) : token

  // Allow if static API key matches
  if (DASHBOARD_API_KEY && bearer === DASHBOARD_API_KEY) return next()

  // Allow if session token is valid and not expired
  if (bearer) {
    try {
      const [payload] = bearer.split('.')
      const { exp } = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
      if (exp && Date.now() <= exp) return next()
    } catch { /* fall through */ }
  }

  // In dev mode (no API key configured), allow all connections
  if (!DASHBOARD_API_KEY) return next()

  next(new Error('Unauthorized'))
})

// Inject io into lib modules so they can broadcast events directly
setAgentIo(io)
setActivityIo(io)
setRunnerIo(io)

// Make io accessible from route handlers via req.app.get('io')
app.set('io', io)

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json())

// Lightweight request logger
app.use((req, _res, next) => {
  process.stdout.write(`[${new Date().toISOString().slice(11, 23)}] ${req.method} ${req.path}\n`)
  next()
})

// ─── Auth middleware ──────────────────────────────────────────────────────────
// The dashboard sends `Authorization: Bearer <session-token>` on every request.
// The backend validates the token is structurally sound (non-empty, not expired).
// For a single-tenant internal tool, this is the right level of protection.
function requireAuth(req, res, next) {
  // /api/health is always public (used by start.sh health checks)
  if (req.path === '/api/health' || req.path === '/health') return next()

  const authHeader = req.headers['authorization'] ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) return res.status(401).json({ error: 'Unauthorized — no token' })

  // If a static DASHBOARD_API_KEY is configured, accept it directly
  if (DASHBOARD_API_KEY && token === DASHBOARD_API_KEY) return next()

  // Otherwise validate session token structure (base64 payload with exp field)
  try {
    const [payload] = token.split('.')
    const { exp } = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
    if (!exp || Date.now() > exp) {
      return res.status(401).json({ error: 'Unauthorized — session expired' })
    }
    return next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized — invalid token' })
  }
}

app.use('/api', requireAuth)

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check — always public
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'cortex-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    port: PORT,
    connectedClients: io.sockets.sockets.size,
    env: {
      anthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hospitablePat: !!process.env.HOSPITABLE_PAT,
      claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
    },
  })
})

// Activity feed
app.get('/api/activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200)
  res.json({ activity: getEntries(limit) })
})

// Agents
app.use('/api/agents', agentsRouter)

// Properties (includes GET /api/properties)
app.use('/api/properties', propertiesRouter)

// Top-level calendar alias: GET /api/calendar/:propertyId
app.get('/api/calendar/:propertyId', async (req, res) => {
  const { getCalendar } = await import('./lib/hospitable.js')
  try {
    const days = await getCalendar(req.params.propertyId)
    res.json({ propertyId: req.params.propertyId, days })
  } catch (err) {
    console.error('[calendar alias]', err.message)
    res.status(500).json({ error: 'Failed to fetch calendar', detail: err.message })
  }
})

// Email triage
app.use('/api/emails', emailsRouter)

// Scheduler jobs
app.use('/api/jobs', jobsRouter)

// CORTEX orchestrator
app.use('/api/orchestrator', orchRouter)

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[cortex-backend] Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error', detail: err.message })
})

// ─── Socket.io connection handling ───────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id} (total: ${io.sockets.sockets.size})`)

  // Push current state to newly connected client
  socket.emit('init', {
    agents: getAllAgents(),
    activity: getEntries(20),
  })

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`)
  })

  // On-demand refresh requests
  socket.on('request:agents', () => {
    socket.emit('agents:snapshot', { agents: getAllAgents() })
  })

  socket.on('request:activity', (payload) => {
    socket.emit('activity:snapshot', { activity: getEntries(payload?.limit ?? 20) })
  })
})

// ─── Periodic KPI broadcast ───────────────────────────────────────────────────
// Emit simulated metric updates every 30 s when clients are connected
setInterval(() => {
  if (io.sockets.sockets.size === 0) return
  const revenue   = Math.round(4200 + Math.random() * 1800)
  const occupancy = Math.round(78   + Math.random() * 15)
  const adr       = Math.round(revenue / (8 * (occupancy / 100)) / 8)
  io.emit('metric:update', {
    timestamp:    new Date().toISOString(),
    revenue,
    occupancy,
    adr,
    activeAgents: getAllAgents().filter((a) => a.status === 'active').length,
  })
}, 30_000)

// ─── Background activity simulation (30–90 s intervals) ─────────────────────
const SIM_ACTIONS = [
  { agent: 'Revenue Agent',    action: 'Repriced Blackcomb Chalet +5% for upcoming long weekend',   property: 'Blackcomb Chalet',       level: 'success' },
  { agent: 'Guest Agent',      action: 'Sent check-in instructions to Maria S.',                    property: 'Surf & Cedar Cabin',      level: 'info'    },
  { agent: 'Operations Agent', action: 'Cleaning crew confirmed for Alpine Loft Whistler turnover', property: 'Alpine Loft Whistler',    level: 'info'    },
  { agent: 'Analytics Agent',  action: 'Occupancy alert: Gastown Heritage Loft below 60%',          property: 'Gastown Heritage Loft',   level: 'warning' },
  { agent: 'Marketing Agent',  action: 'Kitsilano Beach Suite listing description updated',         property: 'Kitsilano Beach Suite',   level: 'success' },
  { agent: 'Revenue Agent',    action: 'Last-minute discount applied to Whistler Village Studio',   property: 'Whistler Village Studio', level: 'info'    },
  { agent: 'Guest Agent',      action: 'Review request sent to Oliver K. post-checkout',            property: 'Coal Harbour Penthouse',  level: 'success' },
  { agent: 'Operations Agent', action: 'Maintenance ticket #482 created — dishwasher fault',       property: 'Pacific Rim Retreat',     level: 'warning' },
]
let simIdx = 0
function scheduleNextSim() {
  const delay = 30_000 + Math.random() * 60_000 // 30–90 s
  setTimeout(() => {
    addEntry({ ...SIM_ACTIONS[simIdx % SIM_ACTIONS.length], detail: '' })
    simIdx++
    scheduleNextSim()
  }, delay)
}
scheduleNextSim()

// ─── Start server ─────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  const keyOk = process.env.ANTHROPIC_API_KEY ? 'loaded OK' : 'MISSING  <- agent runs will fail'
  const patOk = process.env.HOSPITABLE_PAT    ? 'loaded OK' : 'not set   (mock data mode)'
  const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6'
  console.log(`
CORTEX Backend - Solnest AI
  http://localhost:${PORT}

  ANTHROPIC_API_KEY : ${keyOk}
  HOSPITABLE_PAT    : ${patOk}
  CLAUDE_MODEL      : ${model}

  Routes:
    GET  /api/health
    GET  /api/agents              GET|PATCH /api/agents/:id
    POST /api/agents/:id/run
    GET  /api/properties          GET /api/calendar/:propertyId
    GET  /api/emails              PATCH /api/emails/:id
    GET  /api/jobs                POST /api/jobs    PATCH|DELETE /api/jobs/:id
    GET  /api/activity
    POST /api/orchestrator/run
  `)
})

export { app, io, httpServer }
