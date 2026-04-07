import { create } from 'zustand'
import { SCHEDULED_JOBS } from '../data/mockData'
import type { ScheduledJob } from '../types/index'

interface SchedulerState {
  jobs: ScheduledJob[]
  addJob: (job: ScheduledJob) => void
  updateJob: (id: string, updates: Partial<ScheduledJob>) => void
  deleteJob: (id: string) => void
  toggleJobStatus: (id: string) => void
}

export const useSchedulerStore = create<SchedulerState>((set) => ({
  jobs: SCHEDULED_JOBS,
  addJob: (job) => set((state) => ({ jobs: [...state.jobs, job] })),
  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    })),
  deleteJob: (id) => set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) })),
  toggleJobStatus: (id) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status: j.status === 'active' ? 'paused' : 'active' } : j
      ),
    })),
}))
