import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { useActivityStore } from '../store/activityStore'
import { useSystemStore } from '../store/systemStore'

const activityPool = [
  { agent: 'Revenue', action: 'Adjusted Alpine Loft nightly rate +$24 for Easter weekend demand surge', property: 'Alpine Loft Whistler', level: 'success' as const },
  { agent: 'Guest', action: 'Auto-reply sent to Oliver Kastner — honeymoon welcome message crafted', property: 'Kitsilano Beach Suite', level: 'success' as const },
  { agent: 'Operations', action: 'Cleaning crew confirmed for Coal Harbour Penthouse tomorrow 10am', property: 'Coal Harbour Penthouse', level: 'info' as const },
  { agent: 'Revenue', action: 'Tofino market occupancy at 91% — triggered dynamic uplift on Pacific Rim', property: 'Pacific Rim Retreat', level: 'success' as const },
  { agent: 'CORTEX', action: 'Orchestration cycle #1848 complete — all agents nominal', level: 'info' as const },
  { agent: 'Guest', action: 'Maintenance escalation acknowledged — hot tub team dispatched to Blackcomb', property: 'Blackcomb Chalet', level: 'warning' as const },
  { agent: 'Analytics', action: 'Booking velocity +18% over last 7 days — summer demand arriving early', level: 'success' as const },
  { agent: 'Marketing', action: 'Surf & Cedar Cabin Airbnb listing photo reordering complete', property: 'Surf & Cedar Cabin', level: 'info' as const },
  { agent: 'Revenue', action: 'Whistler Village Studio minimum stay extended to 3 nights for peak season', property: 'Whistler Village Studio', level: 'info' as const },
  { agent: 'Operations', action: 'Smart lock battery replaced at Gastown Heritage Loft — confirmed operational', property: 'Gastown Heritage Loft', level: 'success' as const },
  { agent: 'CORTEX', action: 'Email triage cycle complete — 8 processed, 1 escalated to human review', level: 'info' as const },
  { agent: 'Guest', action: 'Check-in instructions pre-sent to James Thornton — arrives in 2 days', property: 'Coal Harbour Penthouse', level: 'info' as const },
  { agent: 'Revenue', action: 'Competitor rate alert: Whistler comp set dropped 8% — evaluating response', level: 'warning' as const },
  { agent: 'Analytics', action: 'Vancouver portfolio RevPAR hit all-time high: $201/night this week', level: 'success' as const },
  { agent: 'Marketing', action: 'GHL pipeline: 2 new direct booking leads added from Google Ads', level: 'success' as const },
]

const agentActions = [
  'Completed dynamic pricing evaluation for all 8 properties',
  'Processed 4 guest messages across active conversations',
  'Scheduled 2 maintenance tasks based on check-out calendar',
  'Generated competitor intelligence report for Whistler market',
  'Synced GHL pipeline with latest booking data',
]

export function useSimulation() {
  const addEntry = useActivityStore((s) => s.addEntry)
  const updateAgentStatus = useSystemStore((s) => s.updateAgentStatus)
  // Use a ref to always read current agents without re-creating intervals
  const agentsRef = useRef(useSystemStore.getState().agents)
  useEffect(() => {
    return useSystemStore.subscribe((state) => {
      agentsRef.current = state.agents
    })
  }, [])

  useEffect(() => {
    // Every 8–12 seconds: add activity feed entry
    function scheduleActivity() {
      const delay = 8000 + Math.random() * 4000
      return setTimeout(() => {
        const pool = activityPool[Math.floor(Math.random() * activityPool.length)]
        addEntry({
          id: `live-${Date.now()}`,
          timestamp: format(new Date(), 'HH:mm'),
          agent: pool.agent,
          action: pool.action,
          property: pool.property,
          level: pool.level,
        })
        activityTimerRef.current = scheduleActivity()
      }, delay)
    }
    const activityTimerRef = { current: scheduleActivity() }

    // Every 30 seconds: update a random active agent's last action
    const agentInterval = setInterval(() => {
      const activeAgents = agentsRef.current.filter((a) => a.status === 'active')
      if (activeAgents.length > 0) {
        const agent = activeAgents[Math.floor(Math.random() * activeAgents.length)]
        updateAgentStatus(agent.id, {
          lastAction: agentActions[Math.floor(Math.random() * agentActions.length)],
          lastRun: format(new Date(), 'HH:mm'),
          tasksCompleted: agent.tasksCompleted + 1,
        })
      }
    }, 30000)

    // Every 60 seconds: increment tasks completed for active agents only
    const taskInterval = setInterval(() => {
      agentsRef.current.forEach((agent) => {
        if (agent.status === 'active' && Math.random() > 0.5) {
          updateAgentStatus(agent.id, {
            tasksCompleted: agent.tasksCompleted + Math.floor(Math.random() * 3) + 1,
          })
        }
      })
    }, 60000)

    return () => {
      clearTimeout(activityTimerRef.current)
      clearInterval(agentInterval)
      clearInterval(taskInterval)
    }
  }, [addEntry, updateAgentStatus])
}
