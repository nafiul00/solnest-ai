import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import { socket } from '../lib/socket'

// Map agent display names to backend IDs
const AGENT_ID_MAP: Record<string, string> = {
  'Revenue Agent': 'a1',
  'Guest Agent': 'a2',
  'Operations Agent': 'a3',
  'Analytics Agent': 'a4',
  'Marketing Agent': 'a5',
}

const AGENT_OUTPUTS: Record<string, string[]> = {
  CORTEX: [
    `[CORTEX] Initializing orchestration cycle #1848...
[CORTEX] Loading agent context from knowledge base...
[Revenue] Fetching PriceLabs data for 8 properties...
[Revenue] Analyzing competitor rates in Whistler market...
[Revenue] Competitor avg: $312/night — our position: $285-420
[Revenue] Applying weekend surge multiplier: 1.18x
[Revenue] Updated: Alpine Loft $285→$338, Blackcomb $420→$496
[Guest] Processing incoming messages: 4 active conversations
[Guest] Sarah Mitchell — generating response for heating query
[Guest] Ava Williams — maintenance escalation triggered
[Ops] Creating ticket #481: Blackcomb Chalet hot tub repair
[Ops] Dispatching: Mike (Maintenance) ETA 90 minutes
[Analytics] Market pulse check: Tofino occupancy 91% (+6%)
[CORTEX] Cycle complete. 23 tasks in 4.2s. All agents nominal.`,
    `[CORTEX] Email triage cycle starting...
[CORTEX] Fetching inbox: 12 new emails detected
[Classifier] booking@airbnb.com → category: booking
[Classifier] maintenance@handypro.ca → category: maintenance
[Classifier] tax@revenuequebec.ca → category: urgent
[Classifier] Unknown sender → category: spam (confidence: 97%)
[Triage] Auto-resolved: 8 emails
[Triage] Escalated to human: 2 emails (tax, complaint)
[Triage] Archived spam: 1 email
[CORTEX] Email triage complete. Next run in 5 minutes.`,
  ],
  'Revenue Agent': [
    `[Revenue] Dynamic pricing evaluation starting...
[Revenue] Loading occupancy data: all 8 properties
[Revenue] Whistler: avg 89% occ — above threshold (80%)
[Revenue] Tofino: avg 85% occ — at threshold
[Revenue] Vancouver: avg 82% occ — slight headroom
[Revenue] Applying rules: lead_time_discount for 3 properties
[Revenue] Evaluating 8 properties...
[Revenue] Syncing to PriceLabs API... done
[Revenue] Syncing to Airbnb API... done
[Revenue] Syncing to VRBO API... done
[Revenue] Total ADR impact: +$18.40/night portfolio avg
[Revenue] Agent cycle complete.`,
    `[Revenue] Competitor intelligence scan...
[Revenue] Scraping Airbnb comps: Whistler Village (18 listings)
[Revenue] Comp set avg: $312/night (↓4% from last week)
[Revenue] Our properties: avg $348/night (↑$36 premium)
[Revenue] Demand signal: Whistler search volume +22% MoM
[Revenue] Easter weekend: 96% comp set booked out
[Revenue] Recommendation: hold rates, apply +8% Easter surge
[Revenue] Applying surge pricing for Apr 18-21...
[Revenue] 8 properties updated. Next check in 4h.`,
  ],
  'Guest Agent': [
    `[Guest] Checking active conversations: 5 guests
[Guest] Sarah Mitchell (Alpine Loft) — 2 unread messages
[Guest] Context: heating issue lower floor, fondue recommendation
[Guest] Generating response: fondue → La Fondue restaurant nearby
[Guest] Generating response: heating → scheduling HVAC check
[Guest] Sending reply to Sarah Mitchell... sent
[Guest] Ava Williams (Blackcomb) — maintenance follow-up
[Guest] Hot tub tech ETA updated: on-site in 30 min
[Guest] Sending ETA update to Ava Williams... sent
[Guest] Oliver Kastner (Kitsilano) — couples massage inquiry
[Guest] Generating: Silk Road Spa recommended (5-min walk)
[Guest] Sending recommendations... sent
[Guest] All conversations current. Next check in 2 min.`,
  ],
  'Operations Agent': [
    `[Ops] Maintenance queue review...
[Ops] Open tickets: 3 active, 1 pending parts
[Ops] Ticket #481: Blackcomb hot tub — tech dispatched ✓
[Ops] Ticket #479: Alpine Loft HVAC — scheduled tomorrow 9am
[Ops] Ticket #477: Pacific Rim deck — parts ordered (ETA 3 days)
[Ops] Checking check-out calendar for cleaning schedule...
[Ops] Tomorrow's check-outs: Surf Cedar (11am), Gastown (10am)
[Ops] Dispatching cleaning crew: Maria + Team B
[Ops] Smart lock codes rotated for 3 incoming guests
[Ops] Supply inventory: towels low at Coal Harbour — reorder sent
[Ops] Operations cycle complete.`,
  ],
  'Analytics Agent': [
    `[Analytics] Weekly market report generating...
[Analytics] Whistler portfolio: RevPAR $198 (↑12% WoW)
[Analytics] Tofino portfolio: RevPAR $221 (↑6% WoW)
[Analytics] Vancouver portfolio: RevPAR $201 (all-time high)
[Analytics] Portfolio occupancy: 87.3% (target: 82%)
[Analytics] Booking window: avg 18.4 days (↑2.1 days)
[Analytics] Top performer: Coal Harbour Penthouse ($480 ADR)
[Analytics] Underperformer: Whistler Village Studio (72% occ)
[Analytics] Recommendation: lower min-stay on Studio to 2 nights
[Analytics] Report saved to Notion workspace.
[Analytics] Next report: Sunday 08:00.`,
  ],
  'Marketing Agent': [
    `[Marketing] Listing optimization scan...
[Marketing] Scanning 8 Airbnb listings for score < 80...
[Marketing] Pacific Rim Retreat: score 74 (below threshold)
[Marketing] Analyzing: title keywords, photo order, description
[Marketing] Rewriting description with local SEO keywords...
[Marketing] New title: "Pacific Rim Retreat | Surf & Forest Views"
[Marketing] Reordering photos: exterior first, hot tub second
[Marketing] GHL pipeline: checking lead status...
[Marketing] 2 new leads from Google Ads this week
[Marketing] Sending follow-up sequence to 3 warm leads
[Marketing] Listing updates submitted to Airbnb API. Review pending.`,
  ],
}

export function useAgentRunner(trigger: number, agent = 'CORTEX', command = '') {
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRunId = useRef<string | null>(null)

  // ─── Local simulation fallback ─────────────────────────────────────────
  const runLocalSimulation = useCallback((agentName: string, cmd: string, triggerIdx: number) => {
    const agentOutputs = AGENT_OUTPUTS[agentName] ?? AGENT_OUTPUTS['CORTEX']
    let text = agentOutputs[triggerIdx % agentOutputs.length]
    if (cmd.trim()) {
      text = `[${agentName.replace(' Agent', '')}] Received: "${cmd.trim()}"\n` + text
    }
    setOutput('')
    setIsRunning(true)
    let i = 0
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      if (i < text.length) {
        setOutput(text.slice(0, i + 1))
        i++
      } else {
        setIsRunning(false)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, 10)
  }, [])

  useEffect(() => {
    if (trigger === 0) return

    const agentId = AGENT_ID_MAP[agent]
    const endpoint = agentId ? `/api/agents/${agentId}/run` : '/api/orchestrator/run'

    // ─── Socket stream handlers ──────────────────────────────────────────
    function onStreamStart(data: { agentId: string; runId: string; agentName: string }) {
      if (agentId && data.agentId !== agentId) return
      activeRunId.current = data.runId
      setOutput('')
      setIsRunning(true)
    }

    function onStreamChunk(data: { agentId: string; runId: string; text: string }) {
      if (data.runId !== activeRunId.current) return
      setOutput(prev => prev + data.text)
    }

    function onStreamEnd(data: { agentId: string; runId: string; durationMs: number; status: string }) {
      if (data.runId !== activeRunId.current) return
      setIsRunning(false)
      activeRunId.current = null
    }

    socket.on('agent:stream:start', onStreamStart)
    socket.on('agent:stream:chunk', onStreamChunk)
    socket.on('agent:stream:end', onStreamEnd)

    // ─── Attempt real API call ───────────────────────────────────────────
    api.post(endpoint, { command: command.trim() || undefined })
      .catch(() => {
        // Backend unavailable — fall back to local simulation
        socket.off('agent:stream:start', onStreamStart)
        socket.off('agent:stream:chunk', onStreamChunk)
        socket.off('agent:stream:end', onStreamEnd)
        runLocalSimulation(agent, command, trigger)
      })

    return () => {
      socket.off('agent:stream:start', onStreamStart)
      socket.off('agent:stream:chunk', onStreamChunk)
      socket.off('agent:stream:end', onStreamEnd)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [trigger])

  return { output, isRunning }
}
