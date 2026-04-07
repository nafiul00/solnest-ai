import { create } from 'zustand'
import { ACTIVITY_LOG } from '../data/mockData'
import type { ActivityEntry } from '../types/index'
import { api } from '../lib/api'
import { socket } from '../lib/socket'

interface ActivityState {
  entries: ActivityEntry[]
  addEntry: (entry: ActivityEntry) => void
  clearOldEntries: () => void
  initFromBackend: () => Promise<void>
}

export const useActivityStore = create<ActivityState>((set) => ({
  entries: ACTIVITY_LOG,
  addEntry: (entry) =>
    set((state) => ({
      entries: [entry, ...state.entries.slice(0, 149)],
    })),
  clearOldEntries: () =>
    set((state) => ({
      entries: state.entries.slice(0, 100),
    })),

  initFromBackend: async () => {
    try {
      const data = await api.get('/api/activity?limit=50')
      if (data?.activity && Array.isArray(data.activity) && data.activity.length > 0) {
        set({ entries: data.activity })
      }
    } catch {
      // Backend offline — keep mock data as fallback
    }
  },
}))

// ─── Socket listeners ──────────────────────────────────────────────────────
socket.on('activity:new', (entry: ActivityEntry) => {
  useActivityStore.getState().addEntry(entry)
})
