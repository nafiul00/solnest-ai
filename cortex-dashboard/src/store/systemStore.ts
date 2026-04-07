import { create } from 'zustand'
import { AGENTS, SYSTEM_HEALTH } from '../data/mockData'
import type { Agent, SystemHealth } from '../types/index'
import { api } from '../lib/api'
import { socket } from '../lib/socket'

export interface Notification {
  id: string
  message: string
  level: string
  time: string
  read: boolean
}

interface SystemState {
  agents: Agent[]
  systemHealth: SystemHealth
  notifications: Notification[]
  updateAgentStatus: (agentId: string, updates: Partial<Agent>) => void
  updateSystemHealth: (updates: Partial<SystemHealth>) => void
  addNotification: (message: string, level: string) => void
  clearNotification: (id: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  initFromBackend: () => Promise<void>
}

export const useSystemStore = create<SystemState>((set) => ({
  agents: AGENTS,
  systemHealth: SYSTEM_HEALTH,
  notifications: [
    { id: 'n1', message: 'Hot tub maintenance ticket #481 created', level: 'warning', time: '2m ago', read: false },
    { id: 'n2', message: 'Alpine Loft price adjusted +12% for weekend', level: 'success', time: '8m ago', read: false },
    { id: 'n3', message: 'Marketing Agent: listing score below threshold', level: 'warning', time: '18m ago', read: true },
    { id: 'n4', message: 'New guest booking: Pacific Rim Retreat — 3 nights', level: 'success', time: '34m ago', read: true },
  ],
  updateAgentStatus: (agentId, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agentId ? { ...a, ...updates } : a)),
    })),
  updateSystemHealth: (updates) =>
    set((state) => ({ systemHealth: { ...state.systemHealth, ...updates } })),
  addNotification: (message, level) =>
    set((state) => ({
      notifications: [
        { id: `n-${Date.now()}`, message, level, time: 'just now', read: false },
        ...state.notifications.slice(0, 9),
      ],
    })),
  clearNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  initFromBackend: async () => {
    try {
      const data = await api.get('/api/agents')
      if (data?.agents && Array.isArray(data.agents) && data.agents.length > 0) {
        set({ agents: data.agents })
      }
    } catch {
      // Backend offline — keep mock data as fallback
    }
  },
}))

// ─── Socket listeners ──────────────────────────────────────────────────────
socket.on('init', (payload: { agents: Agent[] }) => {
  if (payload?.agents && Array.isArray(payload.agents) && payload.agents.length > 0) {
    useSystemStore.setState({ agents: payload.agents })
  }
})

socket.on('agent:update', (agent: Agent) => {
  useSystemStore.getState().updateAgentStatus(agent.id, agent)
})
