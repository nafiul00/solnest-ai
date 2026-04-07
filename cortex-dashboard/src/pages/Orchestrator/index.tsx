import { useState } from 'react'
import { Play, Edit2, Save, X, Power, Zap } from 'lucide-react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { TerminalOutput } from '../../components/shared/TerminalOutput'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PulsingDot } from '../../components/shared/PulsingDot'
import { useAgentRunner } from '../../hooks/useAgentRunner'
import { useSystemStore } from '../../store/systemStore'
import { ORCHESTRATION_LOG } from '../../data/mockData'
import { api } from '../../lib/api'

const SYSTEM_PROMPT = `You are CORTEX, an intelligent STR (Short-Term Rental) operations orchestrator for Solnest AI.

Your role is to coordinate 5 specialized AI agents to manage a portfolio of 8 properties across Whistler, Tofino, and Vancouver, BC.

AGENTS UNDER YOUR CONTROL:
- Revenue Agent: Dynamic pricing, rate optimization, competitor intelligence
- Guest Agent: Guest communication, pre-arrival, issue resolution
- Operations Agent: Maintenance, cleaning, task management
- Analytics Agent: Market reports, performance tracking, trend analysis
- Marketing Agent: Listing optimization, GHL pipeline, content generation

OPERATING PRINCIPLES:
1. Always prioritize guest experience and property quality
2. Make data-driven pricing decisions based on occupancy, demand signals, and competitor rates
3. Escalate urgent issues (safety, severe complaints) to human operators immediately
4. Maintain brand voice: professional, warm, locally knowledgeable
5. Log all decisions with reasoning for audit trail
6. Temperature: 0.3 (deterministic for operations tasks)
7. Max tokens: 4096 per cycle

CONTEXT: Multi-tenant STR management platform. client_id must be present on all records.`

// ─── Agent color map ────────────────────────────────────────────────────────
const AGENT_COLORS: Record<string, string> = {
  a1: 'var(--gold)',
  a2: 'var(--sage)',
  a3: 'var(--terracotta)',
  a4: 'var(--mist)',
  a5: 'var(--purple)',
}

// ─── SVG Architecture Diagram ──────────────────────────────────────────────
function ArchDiagram({ agentStates }: { agentStates: Record<string, boolean> }) {
  // All agent nodes use r=38 — large enough for any label at 10px
  // Input nodes use r=28
  const nodes = [
    { id: 'cortex',   agentId: null, x: 320, y: 168, label: 'CORTEX',    sublabel: 'Orchestrator', color: 'var(--gold)',       r: 46 },
    { id: 'a1',       agentId: 'a1', x: 110, y:  62, label: 'Revenue',   sublabel: 'Agent',        color: 'var(--gold)',       r: 38 },
    { id: 'a2',       agentId: 'a2', x: 530, y:  62, label: 'Guest',     sublabel: 'Agent',        color: 'var(--sage)',       r: 38 },
    { id: 'a3',       agentId: 'a3', x:  84, y: 278, label: 'Ops',       sublabel: 'Agent',        color: 'var(--terracotta)',r: 38 },
    { id: 'a4',       agentId: 'a4', x: 556, y: 278, label: 'Analytics', sublabel: 'Agent',        color: 'var(--mist)',       r: 38 },
    { id: 'a5',       agentId: 'a5', x: 320, y: 302, label: 'Marketing', sublabel: 'Agent',        color: 'var(--purple)',     r: 38 },
    { id: 'whatsapp', agentId: null, x: 608, y: 168, label: 'WhatsApp',  sublabel: 'Input',        color: 'var(--t3)',         r: 28 },
    { id: 'slack',    agentId: null, x:  34, y: 168, label: 'Slack',     sublabel: 'Input',        color: 'var(--t3)',         r: 28 },
    { id: 'email',    agentId: null, x: 320, y:  22, label: 'Email',     sublabel: 'Input',        color: 'var(--t3)',         r: 28 },
  ]

  const edges = [
    { from: 'cortex', to: 'a1' }, { from: 'cortex', to: 'a2' },
    { from: 'cortex', to: 'a3' }, { from: 'cortex', to: 'a4' },
    { from: 'cortex', to: 'a5' },
    { from: 'whatsapp', to: 'cortex' },
    { from: 'slack',    to: 'cortex' },
    { from: 'email',    to: 'cortex' },
  ]

  function getNode(id: string) { return nodes.find(n => n.id === id)! }

  // Font size: no compression, no textLength — just pick a size that fits naturally
  function labelFontSize(label: string, r: number, isCortex: boolean) {
    if (isCortex) return 15
    // approx 0.58em per char in DM Sans bold at given size
    // max label width = (r - 10) * 2
    const maxW = (r - 10) * 2
    const natural = maxW / (label.length * 0.58)
    return Math.min(10.5, Math.max(8, natural))
  }

  return (
    <svg width="100%" height={350} viewBox="0 0 640 350" style={{ overflow: 'visible' }}>
      <defs>
        <filter id="glow-cortex">
          <feGaussianBlur stdDeviation="6" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-agent">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="cortex-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(240,168,48,0.18)" />
          <stop offset="100%" stopColor="rgba(252,250,246,1.0)" />
        </radialGradient>
      </defs>

      {/* Edges */}
      {edges.map((e, i) => {
        const from     = getNode(e.from)
        const to       = getNode(e.to)
        const isAgent  = to.agentId !== null
        const isActive = isAgent ? agentStates[to.agentId ?? ''] !== false : true
        return (
          <line key={i}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={isActive ? 'rgba(212,146,10,0.45)' : 'rgba(10,10,9,0.10)'}
            strokeWidth={isActive ? 1.5 : 1}
            strokeDasharray="6 4"
            className={isActive ? 'animated-dash' : undefined}
            style={{ transition: 'stroke 0.4s, stroke-width 0.4s' }}
          />
        )
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const isAgent  = node.agentId !== null
        const isActive = isAgent ? agentStates[node.agentId ?? ''] !== false : true
        const isCortex = node.id === 'cortex'
        const color    = isActive ? node.color : 'rgba(160,160,150,0.6)'
        const fSize    = labelFontSize(node.label, node.r, isCortex)
        const subSize  = isCortex ? 10.5 : 8.5

        return (
          <g key={node.id}
            style={{ cursor: isAgent ? 'pointer' : 'default', transition: 'opacity 0.35s' }}
            opacity={isActive || !isAgent ? 1 : 0.45}>

            {/* Cortex outer ring */}
            {isCortex && (
              <circle cx={node.x} cy={node.y} r={node.r + 18}
                fill="none" stroke="rgba(212,146,10,0.20)" strokeWidth={1.5} strokeDasharray="4 3" />
            )}

            {/* Halo ring */}
            <circle cx={node.x} cy={node.y} r={node.r + 8}
              fill="none" stroke={isActive ? node.color : 'rgba(130,130,120,0.3)'}
              strokeWidth={isCortex ? 1.5 : 1}
              opacity={isCortex ? 0.45 : isActive ? 0.28 : 0.12}
              style={{ transition: 'all 0.4s' }}
            />

            {/* Circle body */}
            <circle cx={node.x} cy={node.y} r={node.r}
              fill={isCortex ? 'url(#cortex-bg)' : '#FFFFFF'}
              stroke={color}
              strokeWidth={isCortex ? 2.5 : 2}
              filter={isCortex ? 'url(#glow-cortex)' : isActive && isAgent ? 'url(#glow-agent)' : undefined}
              style={{ transition: 'stroke 0.4s, filter 0.4s' }}
            />

            {/* Label — natural font size, no compression */}
            <text
              x={node.x}
              y={node.y - (isCortex ? 6 : 4)}
              textAnchor="middle"
              fill={isActive ? node.color : 'rgba(130,130,120,0.7)'}
              fontSize={fSize}
              fontWeight="700"
              fontFamily="'DM Sans', system-ui, sans-serif"
              style={{ transition: 'fill 0.4s' }}>
              {node.label}
            </text>

            {/* Sublabel */}
            <text
              x={node.x}
              y={node.y + (isCortex ? fSize + 2 : fSize + 2)}
              textAnchor="middle"
              fill="rgba(100,100,90,0.8)"
              fontSize={subSize}
              fontFamily="'DM Sans', system-ui, sans-serif">
              {node.sublabel}
            </text>

            {/* Status indicator dot */}
            {isAgent && (
              <circle
                cx={node.x + node.r - 8} cy={node.y - node.r + 8} r={5}
                fill={isActive ? 'var(--sage)' : 'rgba(138,158,134,0.4)'}
                className={isActive ? 'dot-green' : undefined}
                style={{ transition: 'fill 0.4s' }}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Agent toggle switch ────────────────────────────────────────────────────
function AgentToggle({ agent, active, onToggle }: { agent: { id: string; name: string; role: string }, active: boolean, onToggle: () => void }) {
  const color = AGENT_COLORS[agent.id] ?? 'var(--t3)'
  return (
    <div
      className="card p-3 flex items-center gap-3 cursor-pointer"
      style={{
        borderColor: active ? `${color}40` : 'var(--border)',
        boxShadow: active ? `0 0 14px ${color}18` : 'none',
        transition: 'all 0.3s',
      }}
      onClick={onToggle}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: active ? `${color}18` : 'rgba(10,10,9,0.05)',
        border: `1.5px solid ${active ? color : 'var(--border-mid)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.3s', flexShrink: 0,
      }}>
        <Power size={14} color={active ? color : 'var(--t3)'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--t1)' : 'var(--t3)', transition: 'color 0.3s' }}>{agent.name}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{agent.role}</div>
      </div>
      {/* Toggle pill */}
      <div style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: active ? color : 'rgba(10,10,9,0.10)',
        position: 'relative', transition: 'background 0.3s',
        border: `1px solid ${active ? color : 'rgba(10,10,9,0.20)'}`,
      }}>
        <div style={{
          position: 'absolute', top: 3, left: active ? 18 : 3,
          width: 12, height: 12, borderRadius: '50%',
          background: active ? '#FFFFFF' : 'var(--t2)',
          transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  )
}

export function OrchestratorPage() {
  const { agents, updateAgentStatus } = useSystemStore()
  const [runTrigger, setRunTrigger] = useState(0)
  const [command, setCommand] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('CORTEX')
  const [editPrompt, setEditPrompt] = useState(false)
  const [promptText, setPromptText] = useState(SYSTEM_PROMPT)
  const [modelName, setModelName] = useState('claude-sonnet-4')
  const [temperature, setTemperature] = useState('0.3')
  const [maxTokens, setMaxTokens] = useState('4096')
  const [invokedCommand, setInvokedCommand] = useState('')
  const { output, isRunning } = useAgentRunner(runTrigger, selectedAgent, invokedCommand)

  // Track local on/off per agent (initialise from store status)
  const [agentStates, setAgentStates] = useState<Record<string, boolean>>(
    () => Object.fromEntries(agents.map(a => [a.id, a.status === 'active']))
  )

  const allActive = Object.values(agentStates).every(Boolean)
  const anyActive = Object.values(agentStates).some(Boolean)

  function toggleAgent(id: string) {
    const next = !agentStates[id]
    setAgentStates(s => ({ ...s, [id]: next }))
    updateAgentStatus(id, { status: next ? 'active' : 'idle' })
    api.patch(`/api/agents/${id}`, { status: next ? 'active' : 'idle' }).catch(() => {/* offline — local state already updated */})
  }

  function toggleAll() {
    const next = !allActive
    const newStates = Object.fromEntries(agents.map(a => [a.id, next]))
    setAgentStates(newStates)
    agents.forEach(a => {
      updateAgentStatus(a.id, { status: next ? 'active' : 'idle' })
      api.patch(`/api/agents/${a.id}`, { status: next ? 'active' : 'idle' }).catch(() => {/* offline — local state already updated */})
    })
  }

  const activeCount = Object.values(agentStates).filter(Boolean).length

  return (
    <PageWrapper title="Orchestrator" subtitle="CORTEX multi-agent coordination and control">
      {/* Row 1: Architecture + Controls */}
      <div className="grid grid-cols-2 gap-5 mb-5">

        {/* Architecture Diagram */}
        <div className="card p-5" style={{ borderColor: anyActive ? 'rgba(240,168,48,0.2)' : 'var(--border)', transition: 'border-color 0.4s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PulsingDot status={anyActive ? 'active' : 'idle'} size={8} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t3)' }}>System Architecture</span>
            </div>
            <div style={{ fontSize: 12, color: anyActive ? 'var(--sage)' : 'var(--t3)', fontWeight: 600, transition: 'color 0.3s' }}>
              {activeCount}/{agents.length} agents active
            </div>
          </div>
          <ArchDiagram agentStates={agentStates} />
        </div>

        {/* Right column: Master switch + per-agent toggles + terminal */}
        <div className="flex flex-col gap-4">

          {/* Master CORTEX switch */}
          <div
            className="card p-4 flex items-center gap-4 cursor-pointer"
            style={{
              borderColor: allActive ? 'rgba(240,168,48,0.4)' : 'var(--border)',
              background: allActive ? 'rgba(240,168,48,0.04)' : 'var(--bg-card)',
              transition: 'all 0.3s',
            }}
            onClick={toggleAll}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: allActive ? 'rgba(240,168,48,0.18)' : 'rgba(10,10,9,0.05)',
              border: `2px solid ${allActive ? 'var(--gold)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: allActive ? '0 0 20px rgba(240,168,48,0.3)' : 'none',
              transition: 'all 0.35s',
            }}>
              <Power size={20} color={allActive ? 'var(--gold)' : 'var(--t3)'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: allActive ? 'var(--t1)' : 'var(--t3)', transition: 'color 0.3s' }}>
                {allActive ? 'All Agents Active' : anyActive ? 'Partially Active' : 'All Agents Offline'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
                Click to {allActive ? 'shut down all' : 'activate all'} agents
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20,
              background: allActive ? 'rgba(240,168,48,0.15)' : 'rgba(10,10,9,0.06)',
              border: `1px solid ${allActive ? 'rgba(240,168,48,0.4)' : 'var(--border)'}`,
              fontSize: 12, fontWeight: 600,
              color: allActive ? 'var(--gold)' : 'var(--t3)',
              transition: 'all 0.3s',
            }}>
              <Zap size={12} />
              {allActive ? 'ONLINE' : anyActive ? 'PARTIAL' : 'OFFLINE'}
            </div>
          </div>

          {/* Per-agent toggles */}
          <div className="grid grid-cols-1 gap-2" style={{ flex: 1 }}>
            {agents.map(agent => (
              <AgentToggle
                key={agent.id}
                agent={{ id: agent.id, name: agent.name, role: agent.role }}
                active={agentStates[agent.id] ?? false}
                onToggle={() => toggleAgent(agent.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Terminal + Override */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <TerminalOutput output={output} isRunning={isRunning} height="220px" />

        {/* Manual Override */}
        <div className="card p-4">
          <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--t3)', marginBottom: 14 }}>
            Manual Override
          </h3>
          <div className="flex gap-2 mb-3">
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              style={{ flex: 1 }}
            >
              <option>CORTEX</option>
              {agents.map(a => <option key={a.id}>{a.name}</option>)}
            </select>
          </div>
          <textarea
            value={command}
            onChange={e => setCommand(e.target.value)}
            placeholder="Enter command or instruction for the selected agent..."
            rows={4}
            className="w-full mb-3 resize-none"
            style={{ width: '100%' }}
          />
          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={() => { setInvokedCommand(command); setRunTrigger(t => t + 1); setCommand('') }}
            disabled={isRunning}
          >
            <Play size={14} />
            {isRunning ? 'Running...' : 'Invoke Agent'}
          </button>
        </div>
      </div>

      {/* Row 3: System Prompt + Model Config */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        <div className="col-span-2 card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--t3)' }}>System Prompt</h3>
            <div className="flex gap-2">
              {editPrompt ? (
                <>
                  <button className="btn btn-sm btn-ghost flex items-center gap-1" style={{ color: 'var(--sage)', borderColor: 'rgba(26,122,68,0.35)' }} onClick={() => setEditPrompt(false)}>
                    <Save size={12} /> Save
                  </button>
                  <button className="btn btn-ghost flex items-center gap-1 text-xs py-1 px-2" onClick={() => { setEditPrompt(false); setPromptText(SYSTEM_PROMPT) }}>
                    <X size={12} /> Cancel
                  </button>
                </>
              ) : (
                <button className="btn btn-ghost flex items-center gap-1 text-xs py-1 px-2" onClick={() => setEditPrompt(true)}>
                  <Edit2 size={12} /> Edit
                </button>
              )}
            </div>
          </div>
          {editPrompt ? (
            <textarea
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              rows={12}
              className="w-full resize-none"
              style={{ width: '100%', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
            />
          ) : (
            <pre style={{
              color: 'var(--t2)', whiteSpace: 'pre-wrap', maxHeight: 240,
              fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.7, overflow: 'auto',
            }}>
              {promptText}
            </pre>
          )}
        </div>

        <div className="card p-4">
          <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--t3)', marginBottom: 14 }}>Model Config</h3>
          <div className="space-y-4">
            <div>
              <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Model</label>
              <input value={modelName} onChange={e => setModelName(e.target.value)} className="w-full" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 6 }}>
                Temperature —{' '}
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--gold)' }}>{temperature}</span>
              </label>
              <input type="range" min="0" max="1" step="0.05" value={temperature}
                onChange={e => setTemperature(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--gold)' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Max Tokens</label>
              <input value={maxTokens} onChange={e => setMaxTokens(e.target.value)} className="w-full" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Provider</label>
              <select className="w-full">
                <option>OpenRouter</option>
                <option>Anthropic Direct</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Orchestration Log */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--t3)' }}>Orchestration Log</h3>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)' }}>Last 50 cycles</span>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 280 }}>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Time</th>
                <th>Agents</th>
                <th>Tasks</th>
                <th>Duration</th>
                <th>Status</th>
                <th style={{ width: '40%' }}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {ORCHESTRATION_LOG.map(row => (
                <tr key={row.id}>
                  <td style={{ fontFamily: "'DM Sans', sans-serif", fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--gold)', fontSize: 13 }}>#{row.cycle}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--t3)' }}>{row.timestamp}</td>
                  <td>{row.agentsInvoked}</td>
                  <td>{row.tasksProcessed}</td>
                  <td style={{ fontFamily: "'DM Sans', sans-serif", fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{row.duration}</td>
                  <td>
                    <StatusBadge status={row.status as 'active' | 'warning'} label={row.status === 'success' ? 'OK' : 'Warn'} />
                  </td>
                  <td style={{ color: 'var(--t2)', fontSize: 12 }}>{row.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  )
}
