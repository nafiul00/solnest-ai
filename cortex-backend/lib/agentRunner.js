/**
 * agentRunner.js
 * Runs an agent using GPT-4o via OpenRouter with streaming.
 * Streams token chunks to the Socket.io room for the requesting client.
 * Emits:
 *   agent:stream:start  { agentId, runId }
 *   agent:stream:chunk  { agentId, runId, text }
 *   agent:stream:end    { agentId, runId, duration, status }
 */

import OpenAI from 'openai'
import { v4 as uuid } from 'uuid'
import { getAgentById, updateAgent, recordRun } from './agentState.js'
import { addEntry } from './activityLog.js'

const MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o'

function makeClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: { 'HTTP-Referer': 'https://solneststays.com', 'X-Title': 'Solnest AI' },
  })
}

let _io = null

export function setIo(io) {
  _io = io
}

/**
 * Run an agent and stream output to the given Socket.io socket (or broadcast).
 *
 * @param {string} agentId   - One of a1..a5
 * @param {string} prompt    - Optional override prompt. Defaults to "Run your standard cycle."
 * @param {object} socket    - Socket.io socket to stream to (null = broadcast)
 * @returns {Promise<{ runId: string, text: string, durationMs: number, status: 'success'|'error' }>}
 */
export async function runAgent(agentId, prompt = null, socket = null) {
  const agent = getAgentById(agentId)
  if (!agent) throw new Error(`Agent ${agentId} not found`)

  const runId = uuid()
  const start = Date.now()
  const emit = (event, payload) => {
    if (socket) {
      socket.emit(event, payload)
    } else if (_io) {
      _io.emit(event, payload)
    }
  }

  // Mark agent as running
  updateAgent(agentId, { status: 'active', lastAction: `Running cycle…` })
  emit('agent:stream:start', { agentId, runId, agentName: agent.name })

  const userMessage = prompt ?? `Run your standard operational cycle. Provide a concise status update with specific actions taken or recommended. Today is ${new Date().toLocaleDateString('en-CA')}.`

  let fullText = ''
  let status = 'success'

  try {
    const stream = await makeClient().chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    })

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) {
        fullText += text
        emit('agent:stream:chunk', { agentId, runId, text })
      }
    }

  } catch (err) {
    status = 'error'
    const errMsg = `\n\n[Error: ${err.message}]`
    fullText += errMsg
    emit('agent:stream:chunk', { agentId, runId, text: errMsg })
    console.error(`[agentRunner] ${agent.name} error:`, err.message)
  }

  const durationMs = Date.now() - start
  const action = fullText.split('\n')[0].slice(0, 80) || `${agent.name} cycle complete`

  // Update persistent state
  recordRun(agentId, { duration: durationMs, status, action })

  // Add to activity log
  addEntry({
    agent: agent.name,
    action,
    level: status === 'error' ? 'error' : 'success',
    detail: fullText.length > 120 ? fullText.slice(0, 120) + '…' : fullText,
  })

  emit('agent:stream:end', { agentId, runId, durationMs, status, action })

  return { runId, text: fullText, durationMs, status }
}

/**
 * Run the CORTEX orchestrator cycle — all 5 agents in parallel with an
 * overarching system coordination prompt.
 *
 * @param {object} socket  Socket.io socket to stream to
 * @returns {Promise<void>}
 */
export async function runOrchestrator(socket = null) {
  const orchestratorId = 'cortex-orchestrator'
  const runId = uuid()
  const start = Date.now()

  const emit = (event, payload) => {
    if (socket) socket.emit(event, payload)
    else if (_io) _io.emit(event, payload)
  }

  emit('agent:stream:start', { agentId: orchestratorId, runId, agentName: 'CORTEX Orchestrator' })

  const systemPrompt = `You are CORTEX, the master orchestrator for Solnest Stays' AI property management system.

Your portfolio: 8 STR properties across Whistler, Tofino, and Vancouver.
Your agents: Revenue Agent, Guest Agent, Operations Agent, Analytics Agent, Marketing Agent.

When triggered, you:
1. Assess the current state of all properties and guest pipeline
2. Identify the highest-priority actions across all domains
3. Delegate specific tasks to each agent with clear instructions
4. Synthesize a brief executive report for the property manager

Format:
## CORTEX Status Report — [timestamp]

**Priority Alerts** (if any)
**Agent Assignments**
- Revenue Agent: [specific task]
- Guest Agent: [specific task]
- Operations Agent: [specific task]
- Analytics Agent: [specific task]
- Marketing Agent: [specific task]

**Portfolio Pulse**
[2–3 sentences on overall health]

**Next Cycle**: [recommended timing]`

  const userMessage = `Run the CORTEX coordination cycle. Today is ${new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Provide a full orchestration report.`

  let fullText = ''
  let status = 'success'

  try {
    const stream = await makeClient().chat.completions.create({
      model: MODEL,
      max_tokens: 1500,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    })

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) {
        fullText += text
        emit('agent:stream:chunk', { agentId: orchestratorId, runId, text })
      }
    }

  } catch (err) {
    status = 'error'
    const errMsg = `\n\n[Orchestrator error: ${err.message}]`
    fullText += errMsg
    emit('agent:stream:chunk', { agentId: orchestratorId, runId, text: errMsg })
    console.error('[agentRunner] orchestrator error:', err.message)
  }

  const durationMs = Date.now() - start

  addEntry({
    agent: 'CORTEX Orchestrator',
    action: 'Orchestration cycle complete',
    level: status === 'error' ? 'error' : 'success',
    detail: `${Math.round(durationMs / 1000)}s — ${fullText.length} chars output`,
  })

  emit('agent:stream:end', { agentId: orchestratorId, runId, durationMs, status })

  return { runId, text: fullText, durationMs, status }
}
