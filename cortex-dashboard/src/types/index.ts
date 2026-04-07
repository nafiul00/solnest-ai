// ─── Property & Market ────────────────────────────────────────────────────────
export interface Property {
  id: string
  name: string
  market: string
  bedrooms: number
  basePrice: number
  color: string
}

// ─── Booking & Revenue ────────────────────────────────────────────────────────
export type BookingStatus = 'booked' | 'blocked' | 'available' | 'pending'

export interface BookingDay {
  date: string
  price: number
  status: BookingStatus
  propertyId: string
  guestName?: string
}

export interface RevenueDataPoint {
  date: string
  revenue: number
  occupancy: number
  adr: number
}

// ─── Guest ────────────────────────────────────────────────────────────────────
export interface GuestMessage {
  id: string
  role: 'guest' | 'host' | 'ai'
  content: string
  timestamp: string
}

export interface Guest {
  id: string
  name: string
  email: string
  propertyId: string
  propertyName: string
  checkIn: string
  checkOut: string
  status: 'upcoming' | 'active' | 'departed'
  messages: GuestMessage[]
  unreadCount: number
  avatar: string
  rating?: number
}

// ─── Agent ────────────────────────────────────────────────────────────────────
export type AgentStatus = 'active' | 'idle' | 'error' | 'warning'

export interface AgentRunHistory {
  timestamp: string
  duration: number
  status: 'success' | 'error'
  action: string
}

export interface Agent {
  id: string
  name: string
  role: string
  status: AgentStatus
  lastAction: string
  lastRun: string
  tasksCompleted: number
  errorsToday: number
  runHistory: AgentRunHistory[]
  sparkline: number[]
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
export type ActivityLevel = 'info' | 'success' | 'warning' | 'error'

export interface ActivityEntry {
  id: string
  timestamp: string
  agent: string
  action: string
  property?: string
  level: ActivityLevel
  detail?: string
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
export type JobStatus = 'active' | 'paused' | 'error'

export interface ScheduledJob {
  id: string
  name: string
  cron: string
  nextRun: string
  lastRun: string
  status: JobStatus
  agent: string
  description: string
  runCount: number
}

// ─── Email Triage ─────────────────────────────────────────────────────────────
export type EmailCategory = 'booking' | 'complaint' | 'inquiry' | 'maintenance' | 'review' | 'spam' | 'urgent'
export type EmailTriageStatus = 'pending' | 'triaged' | 'escalated' | 'auto-resolved'

export interface EmailEntry {
  id: string
  from: string
  subject: string
  preview: string
  receivedAt: string
  category: EmailCategory
  status: EmailTriageStatus
  priority: 'high' | 'medium' | 'low'
  property?: string
}

// ─── Kanban ───────────────────────────────────────────────────────────────────
export type KanbanColumn = 'todo' | 'in-progress' | 'done'
export type Priority = 'urgent' | 'high' | 'medium' | 'low'

export interface KanbanTask {
  id: string
  title: string
  property: string
  assignedTo: string
  priority: Priority
  dueDate: string
  column: KanbanColumn
  tags: string[]
}

// ─── System Health ────────────────────────────────────────────────────────────
export interface SystemHealth {
  score: number
  agentsActive: number
  agentsTotal: number
  uptime: string
  lastUpdate: string
  apiStatus: 'operational' | 'degraded' | 'down'
  dbStatus: 'operational' | 'degraded' | 'down'
  webhookStatus: 'operational' | 'degraded' | 'down'
}

// ─── Pricing Rule ─────────────────────────────────────────────────────────────
export interface PricingRule {
  propertyId: string
  minPrice: number
  maxPrice: number
  occupancyThreshold: number
  leadTimeDiscount: number
  currentPrice: number
  occupancy: number
}

// ─── Response Template ────────────────────────────────────────────────────────
export interface ResponseTemplate {
  id: string
  name: string
  category: string
  content: string
  usageCount: number
}

// ─── Integration ─────────────────────────────────────────────────────────────
export interface Integration {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'error'
  lastSync: string
  icon: string
  description: string
}

// ─── Booking Source ───────────────────────────────────────────────────────────
export interface BookingSource {
  name: string
  value: number
  color: string
}

// ─── WhatsApp Contact ─────────────────────────────────────────────────────────
export interface WhatsAppContact {
  id: string
  name: string
  phone: string
  status: 'allowed' | 'blocked'
  lastMessage: string
  messageCount: number
}

// ─── Slack Channel ────────────────────────────────────────────────────────────
export interface SlackChannel {
  id: string
  name: string
  purpose: string
  memberCount: number
  connected: boolean
  lastActivity: string
}
