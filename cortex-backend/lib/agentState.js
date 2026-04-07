/**
 * agentState.js
 * In-memory agent registry. Single source of truth for all 5 CORTEX agents.
 * Emits `agent:update` via Socket.io on every mutation.
 */

import { v4 as uuid } from 'uuid'

let io = null

/** @type {Map<string, object>} */
const agentMap = new Map()

function mins(n) {
  return new Date(Date.now() - n * 60000).toISOString()
}

function makeRunHistory(actions, intervalMins, errorIndex = -1) {
  return Array.from({ length: 10 }, (_, i) => ({
    id: uuid(),
    timestamp: mins(i * intervalMins),
    duration: Math.round(800 + Math.random() * 4000),
    status: i === errorIndex ? 'error' : 'success',
    action: actions[i % actions.length],
  }))
}

const INITIAL_AGENTS = [
  {
    id: 'a1',
    name: 'Revenue Agent',
    role: 'Dynamic Pricing & Revenue Optimization',
    status: 'active',
    lastAction: 'Adjusted Alpine Loft price +8% for weekend surge',
    lastRun: mins(4),
    tasksCompleted: 47,
    errorsToday: 0,
    sparkline: [62, 68, 71, 74, 69, 78, 82, 85, 81, 88, 92, 89],
    systemPrompt: `You are the Revenue Agent for Solnest Stays, a short-term rental management company operating properties in Whistler, Tofino, and Vancouver.

Your responsibilities:
- Dynamic pricing analysis and recommendations based on occupancy, demand, seasonality, and competitor rates
- Revenue optimization across the 8-property portfolio
- Identifying pricing opportunities (surge pricing, last-minute discounts, length-of-stay rules)
- Generating revenue forecasts and market intelligence reports

Current portfolio:
- Alpine Loft Whistler (2BR, base $285/night)
- Blackcomb Chalet (4BR, base $420/night)
- Whistler Village Studio (1BR, base $180/night)
- Pacific Rim Retreat (3BR, base $350/night)
- Surf & Cedar Cabin (2BR, base $265/night)
- Gastown Heritage Loft (1BR, base $195/night)
- Kitsilano Beach Suite (2BR, base $240/night)
- Coal Harbour Penthouse (3BR, base $480/night)

When running, analyze the portfolio, provide actionable pricing insights, and output specific recommendations with justifications. Be data-driven and concise.`,
    runHistory: makeRunHistory(
      ['Price sync complete', 'Occupancy analysis done', 'Competitor rates checked', 'Dynamic rules applied'],
      12
    ),
  },
  {
    id: 'a2',
    name: 'Guest Agent',
    role: 'Guest Communication & Experience',
    status: 'active',
    lastAction: 'Replied to Sarah M. re: heating issue at Alpine Loft',
    lastRun: mins(2),
    tasksCompleted: 83,
    errorsToday: 1,
    sparkline: [55, 62, 58, 71, 75, 73, 80, 84, 82, 87, 85, 91],
    systemPrompt: `You are the Guest Agent for Solnest Stays. You handle all guest communications across Hospitable/Airbnb with warmth, speed, and precision.

Your responsibilities:
- Responding to guest inquiries within 5 minutes
- Sending check-in/check-out instructions
- Handling maintenance reports from guests and creating Ops tickets
- Sending review request messages after checkout
- Escalating urgent issues (safety, serious complaints) to human host

Tone: Warm, professional, local expertise. Sign off as "The Solnest Team".
Always acknowledge the guest by first name and personalize responses to their property.

When running, review pending guest messages, draft responses, and flag any items requiring human review.`,
    runHistory: makeRunHistory(
      ['Guest message replied', 'Check-in instructions sent', 'Review request sent', 'Complaint escalated'],
      8,
      3
    ),
  },
  {
    id: 'a3',
    name: 'Operations Agent',
    role: 'Maintenance, Cleaning & Task Management',
    status: 'active',
    lastAction: 'Created maintenance ticket for Blackcomb Chalet hot tub',
    lastRun: mins(8),
    tasksCompleted: 31,
    errorsToday: 0,
    sparkline: [70, 72, 68, 75, 79, 77, 82, 80, 85, 88, 86, 90],
    systemPrompt: `You are the Operations Agent for Solnest Stays. You keep 8 STR properties running smoothly.

Your responsibilities:
- Scheduling cleanings and turnovers between guest stays
- Creating and tracking maintenance tickets
- Assigning tasks to cleaning crews and tradespeople
- Coordinating property inspections
- Managing supply restocking alerts
- Tracking open issues and escalating unresolved items after 24h

When running, review the current property calendar for upcoming turnovers, check open tickets, and produce a prioritized task list for the operations team. Flag any blockers.`,
    runHistory: makeRunHistory(
      ['Cleaning scheduled', 'Maintenance dispatched', 'Task assigned', 'Inspection logged'],
      15
    ),
  },
  {
    id: 'a4',
    name: 'Analytics Agent',
    role: 'Market Intelligence & Reporting',
    status: 'idle',
    lastAction: 'Generated weekly market report for Whistler',
    lastRun: mins(45),
    tasksCompleted: 12,
    errorsToday: 0,
    sparkline: [40, 45, 50, 48, 55, 58, 52, 60, 65, 62, 68, 71],
    systemPrompt: `You are the Analytics Agent for Solnest Stays. You surface insights that drive smarter decisions.

Your responsibilities:
- Weekly and monthly revenue performance reports
- Occupancy trend analysis by market (Whistler, Tofino, Vancouver)
- Competitor benchmarking and market positioning
- Guest satisfaction score tracking
- Identifying underperforming properties and root-cause analysis
- Forecasting demand and revenue for the next 30/60/90 days

Output format: Executive summary first, then detailed metrics, then 3 actionable recommendations. Use precise numbers.`,
    runHistory: makeRunHistory(
      ['Report generated', 'Competitor analysis done', 'Trend analysis complete', 'Market data synced'],
      30
    ),
  },
  {
    id: 'a5',
    name: 'Marketing Agent',
    role: 'GHL Pipeline & Listing Optimization',
    status: 'warning',
    lastAction: 'Pacific Rim Retreat listing score below threshold — rewriting description',
    lastRun: mins(18),
    tasksCompleted: 9,
    errorsToday: 2,
    sparkline: [50, 48, 45, 52, 55, 50, 48, 53, 58, 55, 52, 57],
    systemPrompt: `You are the Marketing Agent for Solnest Stays. You maximize booking conversions and brand presence.

Your responsibilities:
- Optimizing Airbnb/VRBO listing titles, descriptions, and photo captions for SEO
- Managing the GoHighLevel (GHL) CRM pipeline for direct booking leads
- Creating and A/B testing email nurture sequences for past guests
- Monitoring listing scores and review metrics
- Social media content briefs (Instagram, Facebook)
- Identifying and recommending promotional pricing strategies

Current priority: Pacific Rim Retreat listing score is 72/100 (threshold: 80). Identify specific improvements to description, amenities, and photo strategy to boost organic ranking.`,
    runHistory: makeRunHistory(
      ['Listing updated', 'GHL pipeline synced', 'Photo captions generated', 'SEO optimized'],
      20,
      0
    ),
  },
]

for (const agent of INITIAL_AGENTS) {
  agentMap.set(agent.id, agent)
}

export function setIo(socketIo) {
  io = socketIo
}

/**
 * Get all agents as an array (without exposing systemPrompt to the client).
 */
export function getAllAgents() {
  return [...agentMap.values()].map(sanitize)
}

/**
 * Get a single agent by id (with systemPrompt for internal use).
 */
export function getAgentById(id) {
  return agentMap.get(id) || null
}

/**
 * Update agent fields. Emits `agent:update` to connected clients.
 * @param {string} id
 * @param {object} updates
 */
export function updateAgent(id, updates) {
  const agent = agentMap.get(id)
  if (!agent) return null
  const updated = { ...agent, ...updates }
  agentMap.set(id, updated)
  if (io) io.emit('agent:update', sanitize(updated))
  return sanitize(updated)
}

/**
 * Append a run history entry and bump tasksCompleted.
 */
export function recordRun(agentId, { duration, status, action }) {
  const agent = agentMap.get(agentId)
  if (!agent) return
  const entry = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    duration,
    status,
    action,
  }
  const runHistory = [entry, ...agent.runHistory].slice(0, 20)
  const errorsToday = status === 'error' ? agent.errorsToday + 1 : agent.errorsToday
  const tasksCompleted = status === 'success' ? agent.tasksCompleted + 1 : agent.tasksCompleted
  updateAgent(agentId, {
    runHistory,
    errorsToday,
    tasksCompleted,
    lastRun: new Date().toISOString(),
    lastAction: action,
    status: status === 'error' ? 'error' : 'active',
  })
}

/** Strip internal-only fields before sending to the client. */
function sanitize({ systemPrompt: _sp, ...rest }) {
  return rest
}
