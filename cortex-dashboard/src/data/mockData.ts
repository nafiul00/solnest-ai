import { format, subDays, addDays, subHours, subMinutes } from 'date-fns'
import type {
  Property, BookingDay, RevenueDataPoint, Guest, Agent, ActivityEntry,
  ScheduledJob, EmailEntry, KanbanTask, SystemHealth, PricingRule,
  ResponseTemplate, Integration, BookingSource, WhatsAppContact, SlackChannel
} from '../types/index'

// ─── Properties ───────────────────────────────────────────────────────────────
export const PROPERTIES: Property[] = [
  { id: 'p1', name: 'Alpine Loft Whistler',    market: 'Whistler',  bedrooms: 2, basePrice: 285, color: '#00E5FF' },
  { id: 'p2', name: 'Blackcomb Chalet',         market: 'Whistler',  bedrooms: 4, basePrice: 420, color: '#F5A623' },
  { id: 'p3', name: 'Whistler Village Studio',  market: 'Whistler',  bedrooms: 1, basePrice: 180, color: '#22D3A0' },
  { id: 'p4', name: 'Pacific Rim Retreat',      market: 'Tofino',    bedrooms: 3, basePrice: 350, color: '#A78BFA' },
  { id: 'p5', name: 'Surf & Cedar Cabin',       market: 'Tofino',    bedrooms: 2, basePrice: 265, color: '#F25D5D' },
  { id: 'p6', name: 'Gastown Heritage Loft',    market: 'Vancouver', bedrooms: 1, basePrice: 195, color: '#FB923C' },
  { id: 'p7', name: 'Kitsilano Beach Suite',    market: 'Vancouver', bedrooms: 2, basePrice: 240, color: '#F472B6' },
  { id: 'p8', name: 'Coal Harbour Penthouse',   market: 'Vancouver', bedrooms: 3, basePrice: 480, color: '#06B6D4' },
]

// ─── 30-day booking history ───────────────────────────────────────────────────
const guestNames = [
  'Sarah M.', 'James T.', 'Emma L.', 'Oliver K.', 'Ava W.',
  'Liam H.', 'Sophia R.', 'Noah B.', 'Isabella D.', 'Mason G.',
]

export function generateBookingCalendar(propertyId: string, basePrice: number): BookingDay[] {
  const days: BookingDay[] = []
  for (let i = 0; i < 30; i++) {
    const date = format(addDays(new Date(), i - 5), 'yyyy-MM-dd')
    const roll = Math.random()
    const status = roll < 0.85 ? (Math.random() < 0.92 ? 'booked' : 'blocked') : (Math.random() < 0.5 ? 'available' : 'pending')
    const variance = (Math.random() - 0.4) * 0.6
    const price = Math.round(basePrice * (1 + variance))
    days.push({
      date,
      price,
      status,
      propertyId,
      guestName: status === 'booked' ? guestNames[Math.floor(Math.random() * guestNames.length)] : undefined,
    })
  }
  return days
}

export const BOOKING_CALENDARS: Record<string, BookingDay[]> = Object.fromEntries(
  PROPERTIES.map(p => [p.id, generateBookingCalendar(p.id, p.basePrice)])
)

// ─── Revenue data (90 days) ───────────────────────────────────────────────────
export const REVENUE_DATA: RevenueDataPoint[] = Array.from({ length: 90 }, (_, i) => {
  const date = format(subDays(new Date(), 89 - i), 'MMM dd')
  const dayOfWeek = (i + 2) % 7
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const base = 4200
  const trend = i * 8
  const weekend = isWeekend ? 1800 : 0
  const noise = (Math.random() - 0.5) * 800
  const revenue = Math.round(base + trend + weekend + noise)
  const occupancy = Math.round(75 + (isWeekend ? 15 : 0) + (Math.random() - 0.5) * 15)
  const adr = Math.round(revenue / (8 * (occupancy / 100)) / 8)
  return { date, revenue: Math.max(1800, revenue), occupancy: Math.min(100, Math.max(60, occupancy)), adr: Math.max(120, Math.min(480, adr)) }
})

// ─── Guests ───────────────────────────────────────────────────────────────────
export const GUESTS: Guest[] = [
  {
    id: 'g1', name: 'Sarah Mitchell', email: 'sarah.m@email.com',
    propertyId: 'p1', propertyName: 'Alpine Loft Whistler',
    checkIn: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    status: 'active', unreadCount: 2, avatar: 'SM', rating: 4.8,
    messages: [
      { id: 'm1', role: 'guest', content: 'Hi! We just arrived. The place is beautiful! Quick question — where do we find the ski pass lockers?', timestamp: format(subHours(new Date(), 2), 'HH:mm') },
      { id: 'm2', role: 'ai', content: 'Welcome Sarah! So glad you love the loft. The ski pass lockers are in the building lobby, code is 4821. Ski-in/ski-out access is via the blue door on the east side. Enjoy the slopes!', timestamp: format(subHours(new Date(), 1), 'HH:mm') },
      { id: 'm3', role: 'guest', content: 'Perfect, found them! One more thing — is there a good spot for fondue nearby?', timestamp: format(subMinutes(new Date(), 30), 'HH:mm') },
      { id: 'm4', role: 'guest', content: 'Also the heating seems a bit temperamental on the lower floor?', timestamp: format(subMinutes(new Date(), 15), 'HH:mm') },
    ],
  },
  {
    id: 'g2', name: 'James Thornton', email: 'james.t@company.io',
    propertyId: 'p8', propertyName: 'Coal Harbour Penthouse',
    checkIn: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    status: 'upcoming', unreadCount: 0, avatar: 'JT', rating: undefined,
    messages: [
      { id: 'm5', role: 'guest', content: 'Hi there! I have a business group of 6 arriving next week. Can we arrange early check-in?', timestamp: format(subDays(new Date(), 1), 'HH:mm') },
      { id: 'm6', role: 'ai', content: 'Hi James! Welcome to Coal Harbour Penthouse. We can arrange early check-in at 12pm (standard is 3pm) for an additional $75 fee. The penthouse can accommodate up to 8 guests comfortably. Shall I confirm the early check-in?', timestamp: format(subDays(new Date(), 1), 'HH:mm') },
      { id: 'm7', role: 'guest', content: 'Yes please! And do you have any recommendations for catering services?', timestamp: format(subHours(new Date(), 5), 'HH:mm') },
    ],
  },
  {
    id: 'g3', name: 'Emma Liu', email: 'emma.liu@gmail.com',
    propertyId: 'p4', propertyName: 'Pacific Rim Retreat',
    checkIn: format(subDays(new Date(), 3), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    status: 'active', unreadCount: 0, avatar: 'EL', rating: 5.0,
    messages: [
      { id: 'm8', role: 'guest', content: 'The surf lessons you recommended were AMAZING. This place is perfect!', timestamp: format(subHours(new Date(), 4), 'HH:mm') },
      { id: 'm9', role: 'host', content: 'So wonderful to hear! You picked the best week — the swells have been incredible. Safe travels home!', timestamp: format(subHours(new Date(), 3), 'HH:mm') },
    ],
  },
  {
    id: 'g4', name: 'Oliver Kastner', email: 'o.kastner@work.de',
    propertyId: 'p7', propertyName: 'Kitsilano Beach Suite',
    checkIn: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), 12), 'yyyy-MM-dd'),
    status: 'upcoming', unreadCount: 1, avatar: 'OK', rating: undefined,
    messages: [
      { id: 'm10', role: 'guest', content: 'Guten Tag! Coming from Germany for our honeymoon. Is the beach within walking distance?', timestamp: format(subHours(new Date(), 8), 'HH:mm') },
      { id: 'm11', role: 'ai', content: 'Willkommen Oliver! Congratulations on your upcoming wedding! Kitsilano Beach is literally a 3-minute walk from the suite — you can see it from the bedroom window. We\'ll prepare a complimentary welcome bottle of BC wine for you. Herzlichen Glückwunsch!', timestamp: format(subHours(new Date(), 7), 'HH:mm') },
      { id: 'm12', role: 'guest', content: 'Wunderbar! Can you recommend a couples massage nearby?', timestamp: format(subHours(new Date(), 1), 'HH:mm') },
    ],
  },
  {
    id: 'g5', name: 'Ava Williams', email: 'avaw@family.net',
    propertyId: 'p2', propertyName: 'Blackcomb Chalet',
    checkIn: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
    status: 'active', unreadCount: 3, avatar: 'AW', rating: undefined,
    messages: [
      { id: 'm13', role: 'guest', content: 'The hot tub jets are not working properly on the left side', timestamp: format(subHours(new Date(), 6), 'HH:mm') },
      { id: 'm14', role: 'ai', content: 'Hi Ava! I\'m so sorry about the hot tub issue. I\'ve dispatched a maintenance tech — they\'ll be there within 2 hours. In the meantime, the main jets on the right should still work perfectly!', timestamp: format(subHours(new Date(), 5), 'HH:mm') },
      { id: 'm15', role: 'guest', content: 'OK thank you. Also we are missing some extra towels?', timestamp: format(subHours(new Date(), 2), 'HH:mm') },
      { id: 'm16', role: 'guest', content: 'And one of the ski boot warmers seems broken', timestamp: format(subHours(new Date(), 1), 'HH:mm') },
      { id: 'm17', role: 'guest', content: 'Apart from those things the chalet is absolutely stunning!', timestamp: format(subMinutes(new Date(), 20), 'HH:mm') },
    ],
  },
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `g${i + 6}`,
    name: ['Liam Harris', 'Sophia Reynolds', 'Noah Brooks', 'Isabella Dunn', 'Mason Green', 'Charlotte Fox', 'Ethan Cole', 'Amelia Ward', 'Lucas King', 'Mia Scott', 'Henry Adams', 'Evelyn Baker', 'Alexander Hill', 'Harper Young', 'Daniel Wright'][i],
    email: `guest${i + 6}@example.com`,
    propertyId: PROPERTIES[i % 8].id,
    propertyName: PROPERTIES[i % 8].name,
    checkIn: format(subDays(new Date(), Math.floor(Math.random() * 10)), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), Math.floor(Math.random() * 10) + 1), 'yyyy-MM-dd'),
    status: (['upcoming', 'active', 'departed'] as const)[Math.floor(Math.random() * 3)],
    unreadCount: Math.floor(Math.random() * 3),
    avatar: ['LH', 'SR', 'NB', 'ID', 'MG', 'CF', 'EC', 'AW', 'LK', 'MS', 'HA', 'EB', 'AH', 'HY', 'DW'][i],
    rating: Math.random() > 0.4 ? Math.round((4.2 + Math.random() * 0.8) * 10) / 10 : undefined,
    messages: [
      { id: `msg${i}a`, role: 'guest' as const, content: 'Great property, loved the location!', timestamp: format(subHours(new Date(), Math.floor(Math.random() * 24)), 'HH:mm') },
    ],
  })),
]

// ─── Agents ───────────────────────────────────────────────────────────────────
export const AGENTS: Agent[] = [
  {
    id: 'a1', name: 'Revenue Agent', role: 'Dynamic Pricing & Revenue Optimization',
    status: 'active', lastAction: 'Adjusted Alpine Loft price +8% for weekend surge',
    lastRun: format(subMinutes(new Date(), 4), 'HH:mm'), tasksCompleted: 47, errorsToday: 0,
    sparkline: [62, 68, 71, 74, 69, 78, 82, 85, 81, 88, 92, 89],
    runHistory: Array.from({ length: 10 }, (_, i) => ({
      timestamp: format(subMinutes(new Date(), i * 12), 'HH:mm'),
      duration: Math.round(1200 + Math.random() * 3000),
      status: Math.random() > 0.1 ? 'success' as const : 'error' as const,
      action: ['Price sync complete', 'Occupancy analysis done', 'Competitor rates checked', 'Dynamic rules applied'][Math.floor(Math.random() * 4)],
    })),
  },
  {
    id: 'a2', name: 'Guest Agent', role: 'Guest Communication & Experience',
    status: 'active', lastAction: 'Replied to Sarah M. re: heating issue at Alpine Loft',
    lastRun: format(subMinutes(new Date(), 2), 'HH:mm'), tasksCompleted: 83, errorsToday: 1,
    sparkline: [55, 62, 58, 71, 75, 73, 80, 84, 82, 87, 85, 91],
    runHistory: Array.from({ length: 10 }, (_, i) => ({
      timestamp: format(subMinutes(new Date(), i * 8), 'HH:mm'),
      duration: Math.round(800 + Math.random() * 2000),
      status: i === 3 ? 'error' as const : 'success' as const,
      action: ['Guest message replied', 'Check-in instructions sent', 'Review request sent', 'Complaint escalated'][Math.floor(Math.random() * 4)],
    })),
  },
  {
    id: 'a3', name: 'Operations Agent', role: 'Maintenance, Cleaning & Task Management',
    status: 'active', lastAction: 'Created maintenance ticket for Blackcomb Chalet hot tub',
    lastRun: format(subMinutes(new Date(), 8), 'HH:mm'), tasksCompleted: 31, errorsToday: 0,
    sparkline: [70, 72, 68, 75, 79, 77, 82, 80, 85, 88, 86, 90],
    runHistory: Array.from({ length: 10 }, (_, i) => ({
      timestamp: format(subMinutes(new Date(), i * 15), 'HH:mm'),
      duration: Math.round(600 + Math.random() * 1500),
      status: 'success' as const,
      action: ['Cleaning scheduled', 'Maintenance dispatched', 'Task assigned', 'Inspection logged'][Math.floor(Math.random() * 4)],
    })),
  },
  {
    id: 'a4', name: 'Analytics Agent', role: 'Market Intelligence & Reporting',
    status: 'idle', lastAction: 'Generated weekly market report for Whistler',
    lastRun: format(subMinutes(new Date(), 45), 'HH:mm'), tasksCompleted: 12, errorsToday: 0,
    sparkline: [40, 45, 50, 48, 55, 58, 52, 60, 65, 62, 68, 71],
    runHistory: Array.from({ length: 10 }, (_, i) => ({
      timestamp: format(subMinutes(new Date(), i * 30), 'HH:mm'),
      duration: Math.round(5000 + Math.random() * 10000),
      status: 'success' as const,
      action: ['Report generated', 'Competitor analysis done', 'Trend analysis complete', 'Market data synced'][Math.floor(Math.random() * 4)],
    })),
  },
  {
    id: 'a5', name: 'Marketing Agent', role: 'GHL Pipeline & Listing Optimization',
    status: 'warning', lastAction: 'Pacific Rim Retreat listing score below threshold — rewriting description',
    lastRun: format(subMinutes(new Date(), 18), 'HH:mm'), tasksCompleted: 9, errorsToday: 2,
    sparkline: [50, 48, 45, 52, 55, 50, 48, 53, 58, 55, 52, 57],
    runHistory: Array.from({ length: 10 }, (_, i) => ({
      timestamp: format(subMinutes(new Date(), i * 20), 'HH:mm'),
      duration: Math.round(2000 + Math.random() * 5000),
      status: i < 2 ? 'error' as const : 'success' as const,
      action: ['Listing updated', 'GHL pipeline synced', 'Photo captions generated', 'SEO optimized'][Math.floor(Math.random() * 4)],
    })),
  },
]

// ─── Activity Feed Pool ───────────────────────────────────────────────────────
const activityPool = [
  { agent: 'Revenue', action: 'Adjusted Alpine Loft Whistler nightly rate +12% for upcoming long weekend', property: 'Alpine Loft Whistler', level: 'success' as const },
  { agent: 'Revenue', action: 'Detected competitor rate drop in Tofino market — triggering competitive analysis', property: 'Pacific Rim Retreat', level: 'warning' as const },
  { agent: 'Revenue', action: 'Applied 7-day lead time discount of 8% for Whistler Village Studio', property: 'Whistler Village Studio', level: 'info' as const },
  { agent: 'Revenue', action: 'Blackcomb Chalet occupancy at 96% — raised min price floor to $440', property: 'Blackcomb Chalet', level: 'success' as const },
  { agent: 'Revenue', action: 'ADR optimization complete: $312 avg across Whistler portfolio (+4.2% WoW)', level: 'success' as const },
  { agent: 'Guest', action: 'Auto-replied to Sarah Mitchell re: ski locker access codes', property: 'Alpine Loft Whistler', level: 'success' as const },
  { agent: 'Guest', action: 'Sent pre-arrival instructions to James Thornton (Coal Harbour check-in +2 days)', property: 'Coal Harbour Penthouse', level: 'info' as const },
  { agent: 'Guest', action: 'Escalated hot tub complaint from Ava Williams to maintenance team', property: 'Blackcomb Chalet', level: 'warning' as const },
  { agent: 'Guest', action: 'Review request sent to Emma Liu — Pacific Rim Retreat checkout today', property: 'Pacific Rim Retreat', level: 'info' as const },
  { agent: 'Guest', action: 'Sentiment analysis: 94% positive across all active conversations this week', level: 'success' as const },
  { agent: 'Guest', action: 'Late check-out request approved for Kitsilano Beach Suite — guest extended 2hr', property: 'Kitsilano Beach Suite', level: 'info' as const },
  { agent: 'Operations', action: 'Maintenance ticket #481 created — Blackcomb Chalet hot tub jet repair', property: 'Blackcomb Chalet', level: 'warning' as const },
  { agent: 'Operations', action: 'Cleaning crew dispatched to Gastown Heritage Loft — checkout confirmed', property: 'Gastown Heritage Loft', level: 'info' as const },
  { agent: 'Operations', action: 'Surf & Cedar Cabin inspection complete — all items checked ✓', property: 'Surf & Cedar Cabin', level: 'success' as const },
  { agent: 'Operations', action: 'Restocking order placed: Kitsilano Beach Suite (towels, coffee, toiletries)', property: 'Kitsilano Beach Suite', level: 'info' as const },
  { agent: 'Operations', action: 'HVAC maintenance reminder sent for Coal Harbour Penthouse — next: Apr 15', property: 'Coal Harbour Penthouse', level: 'info' as const },
  { agent: 'Operations', action: 'Smart lock battery low on Alpine Loft Whistler — alert sent to cleaner', property: 'Alpine Loft Whistler', level: 'warning' as const },
  { agent: 'Analytics', action: 'Weekly market report generated — Whistler ADR up 6.8% YoY', level: 'success' as const },
  { agent: 'Analytics', action: 'Booking pace analysis: Tofino summer season 34% ahead of last year', level: 'success' as const },
  { agent: 'Analytics', action: 'Competitor alert: New 4BR property listed in Whistler at $380/night', level: 'warning' as const },
  { agent: 'Analytics', action: 'RevPAR for Vancouver portfolio: $198 (+11.2% MoM) — all-time high', level: 'success' as const },
  { agent: 'Marketing', action: 'Pacific Rim Retreat listing description rewritten — score improved 72→89', property: 'Pacific Rim Retreat', level: 'success' as const },
  { agent: 'Marketing', action: 'GHL pipeline sync complete — 3 new leads added to follow-up sequence', level: 'info' as const },
  { agent: 'Marketing', action: 'Airbnb photo optimization failed for Surf & Cedar Cabin — retry scheduled', property: 'Surf & Cedar Cabin', level: 'error' as const },
  { agent: 'Marketing', action: 'Email campaign sent: "Spring Tofino" — 42% open rate, 8 bookings converted', level: 'success' as const },
  { agent: 'CORTEX', action: 'All agent health checks passed — system operating at 96.4% efficiency', level: 'success' as const },
  { agent: 'CORTEX', action: 'Orchestration cycle #1847 complete — 23 tasks processed in 4.2s', level: 'info' as const },
  { agent: 'CORTEX', action: 'Email triage run complete — 12 emails processed, 2 escalated', level: 'info' as const },
  { agent: 'CORTEX', action: 'Scheduler triggered: nightly revenue sync for all 8 properties', level: 'info' as const },
  { agent: 'Revenue', action: 'Dynamic pricing rule: peak weekend surcharge activated for next 3 properties', level: 'success' as const },
]

function makeActivityEntries(count: number): ActivityEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const pool = activityPool[i % activityPool.length]
    const minsAgo = i * Math.ceil(Math.random() * 8 + 2)
    return {
      id: `act-${i}`,
      timestamp: format(subMinutes(new Date(), minsAgo), 'HH:mm'),
      agent: pool.agent,
      action: pool.action,
      property: pool.property,
      level: pool.level,
      detail: undefined,
    }
  })
}

export const ACTIVITY_LOG: ActivityEntry[] = makeActivityEntries(100)

// ─── Scheduled Jobs ───────────────────────────────────────────────────────────
export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    id: 'j1', name: 'Nightly Price Sync', cron: '0 2 * * *',
    nextRun: format(addDays(new Date(), 1), "yyyy-MM-dd 02:00"),
    lastRun: format(subHours(new Date(), 6), "yyyy-MM-dd HH:mm"),
    status: 'active', agent: 'Revenue Agent', runCount: 312,
    description: 'Syncs dynamic pricing for all 8 properties based on occupancy, competitor rates, and demand signals',
  },
  {
    id: 'j2', name: 'Email Triage', cron: '*/5 * * * *',
    nextRun: format(addDays(new Date(), 0), "yyyy-MM-dd HH:mm"),
    lastRun: format(subMinutes(new Date(), 4), "yyyy-MM-dd HH:mm"),
    status: 'active', agent: 'CORTEX Orchestrator', runCount: 8842,
    description: 'Reads inbox, categorizes and triages incoming emails with AI classification',
  },
  {
    id: 'j3', name: 'Guest Review Requests', cron: '0 10 * * *',
    nextRun: format(addDays(new Date(), 1), "yyyy-MM-dd 10:00"),
    lastRun: format(subHours(new Date(), 14), "yyyy-MM-dd HH:mm"),
    status: 'active', agent: 'Guest Agent', runCount: 187,
    description: 'Sends personalized review request emails to guests who checked out in the last 24 hours',
  },
  {
    id: 'j4', name: 'Weekly Analytics Report', cron: '0 8 * * 1',
    nextRun: format(addDays(new Date(), 3), "yyyy-MM-dd 08:00"),
    lastRun: format(subDays(new Date(), 4), "yyyy-MM-dd 08:00"),
    status: 'active', agent: 'Analytics Agent', runCount: 44,
    description: 'Generates comprehensive revenue, occupancy, and market intelligence report across all markets',
  },
  {
    id: 'j5', name: 'Listing Score Audit', cron: '0 0 * * 3',
    nextRun: format(addDays(new Date(), 2), "yyyy-MM-dd 00:00"),
    lastRun: format(subDays(new Date(), 5), "yyyy-MM-dd 00:00"),
    status: 'paused', agent: 'Marketing Agent', runCount: 22,
    description: 'Audits all listing quality scores on Airbnb/VRBO and triggers rewrites for listings below 80/100',
  },
]

// ─── Email Triage ─────────────────────────────────────────────────────────────
const emailSenders = [
  'booking@airbnb.com', 'noreply@vrbo.com', 'sarah.m@gmail.com',
  'maintenance@handypro.ca', 'reviews@airbnb.com', 'james.t@corporate.io',
  'hello@tofinosurf.com', 'tax@revenuequebec.ca', 'info@whistlercleaning.ca',
  'support@pricelabs.co', 'billing@ghl.io', 'alert@stripe.com',
]

export const EMAIL_TRIAGE: EmailEntry[] = Array.from({ length: 50 }, (_, i) => {
  const categories = ['booking', 'complaint', 'inquiry', 'maintenance', 'review', 'spam', 'urgent'] as const
  const statuses = ['pending', 'triaged', 'escalated', 'auto-resolved'] as const
  const priorities = ['high', 'medium', 'low'] as const
  const subjects = [
    'New booking confirmation — Alpine Loft Whistler Apr 12-15',
    'Noise complaint from neighbor at Blackcomb Chalet',
    'Question about parking at Coal Harbour Penthouse',
    'Hot tub not working — Blackcomb Chalet urgent',
    'Outstanding 5-star review from Emma Liu!',
    'Your listing score dropped — action required',
    'Invoice #4821 — Whistler cleaning service',
    'Tax document required for Q1 STR income',
    'Guest locked out of Pacific Rim Retreat',
    'VRBO inquiry: family of 6 for August long weekend',
    'Maintenance completed: Gastown Heritage Loft',
    'PriceLabs sync error — manual review needed',
    'New direct booking lead from Google search',
    'Carbon monoxide detector battery low — Surf & Cedar',
    'Guest requesting early check-in at Kitsilano Suite',
  ]
  const cat = categories[i % categories.length]
  return {
    id: `em-${i}`,
    from: emailSenders[i % emailSenders.length],
    subject: subjects[i % subjects.length],
    preview: 'Click to view full email content and take action...',
    receivedAt: format(subMinutes(new Date(), i * 18 + 5), 'MMM dd HH:mm'),
    category: cat,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    priority: cat === 'urgent' || cat === 'complaint' ? 'high' : priorities[Math.floor(Math.random() * priorities.length)],
    property: Math.random() > 0.3 ? PROPERTIES[Math.floor(Math.random() * 8)].name : undefined,
  }
})

// ─── Kanban Tasks ─────────────────────────────────────────────────────────────
export const KANBAN_TASKS: KanbanTask[] = [
  { id: 'k1', title: 'Fix hot tub jets — Blackcomb Chalet', property: 'Blackcomb Chalet', assignedTo: 'Mike (Maintenance)', priority: 'urgent', dueDate: format(addDays(new Date(), 0), 'MMM dd'), column: 'in-progress', tags: ['maintenance', 'guest-facing'] },
  { id: 'k2', title: 'Replace smart lock batteries — Alpine Loft', property: 'Alpine Loft Whistler', assignedTo: 'Sarah (Cleaner)', priority: 'high', dueDate: format(addDays(new Date(), 1), 'MMM dd'), column: 'todo', tags: ['maintenance', 'urgent'] },
  { id: 'k3', title: 'Deep clean after 7-day stay — Coal Harbour', property: 'Coal Harbour Penthouse', assignedTo: 'Elite Cleaning Co.', priority: 'high', dueDate: format(addDays(new Date(), 2), 'MMM dd'), column: 'todo', tags: ['cleaning'] },
  { id: 'k4', title: 'Restock amenities — Kitsilano Beach Suite', property: 'Kitsilano Beach Suite', assignedTo: 'Operations Team', priority: 'medium', dueDate: format(addDays(new Date(), 1), 'MMM dd'), column: 'in-progress', tags: ['restocking'] },
  { id: 'k5', title: 'Update welcome guide — Pacific Rim Retreat', property: 'Pacific Rim Retreat', assignedTo: 'Content Team', priority: 'low', dueDate: format(addDays(new Date(), 7), 'MMM dd'), column: 'todo', tags: ['content'] },
  { id: 'k6', title: 'HVAC filter replacement — Gastown Heritage', property: 'Gastown Heritage Loft', assignedTo: 'Mike (Maintenance)', priority: 'medium', dueDate: format(addDays(new Date(), 4), 'MMM dd'), column: 'todo', tags: ['maintenance', 'scheduled'] },
  { id: 'k7', title: 'Photography session — Surf & Cedar Cabin', property: 'Surf & Cedar Cabin', assignedTo: 'Pacific Photos Co.', priority: 'medium', dueDate: format(addDays(new Date(), 10), 'MMM dd'), column: 'todo', tags: ['marketing'] },
  { id: 'k8', title: 'Guest inspection — Whistler Village Studio', property: 'Whistler Village Studio', assignedTo: 'Sarah (Cleaner)', priority: 'high', dueDate: format(addDays(new Date(), 0), 'MMM dd'), column: 'done', tags: ['inspection'] },
  { id: 'k9', title: 'Water heater annual service — Alpine Loft', property: 'Alpine Loft Whistler', assignedTo: 'AquaServ BC', priority: 'medium', dueDate: format(addDays(new Date(), 14), 'MMM dd'), column: 'done', tags: ['maintenance', 'annual'] },
  { id: 'k10', title: 'Listing optimization — all Tofino properties', property: 'Pacific Rim Retreat', assignedTo: 'Marketing Agent', priority: 'high', dueDate: format(addDays(new Date(), 3), 'MMM dd'), column: 'in-progress', tags: ['marketing', 'seo'] },
  { id: 'k11', title: 'Install additional blackout blinds — Coal Harbour', property: 'Coal Harbour Penthouse', assignedTo: 'BC Blinds Ltd.', priority: 'low', dueDate: format(addDays(new Date(), 21), 'MMM dd'), column: 'todo', tags: ['improvement'] },
  { id: 'k12', title: 'Fix wobbly deck railing — Surf & Cedar', property: 'Surf & Cedar Cabin', assignedTo: 'Mike (Maintenance)', priority: 'high', dueDate: format(addDays(new Date(), 2), 'MMM dd'), column: 'done', tags: ['maintenance', 'safety'] },
]

// ─── System Health ────────────────────────────────────────────────────────────
export const SYSTEM_HEALTH: SystemHealth = {
  score: 94,
  agentsActive: 4,
  agentsTotal: 5,
  uptime: '99.7%',
  lastUpdate: format(new Date(), 'HH:mm:ss'),
  apiStatus: 'operational',
  dbStatus: 'operational',
  webhookStatus: 'operational',
}

// ─── Pricing Rules ────────────────────────────────────────────────────────────
export const PRICING_RULES: PricingRule[] = PROPERTIES.map((p, i) => ({
  propertyId: p.id,
  minPrice: Math.round(p.basePrice * 0.7),
  maxPrice: Math.round(p.basePrice * 2.2),
  occupancyThreshold: 80,
  leadTimeDiscount: [5, 8, 5, 10, 7, 6, 8, 5][i],
  currentPrice: Math.round(p.basePrice * (1.1 + Math.random() * 0.3)),
  occupancy: [92, 96, 78, 85, 88, 74, 91, 83][i],
}))

// ─── Response Templates ───────────────────────────────────────────────────────
export const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  { id: 't1', name: 'Check-in Instructions', category: 'Operations', content: 'Welcome! Your check-in details:\n\n📍 Address: [PROPERTY_ADDRESS]\n🔑 Lock code: [LOCK_CODE]\n🅿️ Parking: [PARKING_DETAILS]\n\nWiFi: [WIFI_NAME] | Pass: [WIFI_PASS]\n\nFeel free to reach out anytime. Enjoy your stay!', usageCount: 284 },
  { id: 't2', name: 'Late Check-out Approval', category: 'Operations', content: 'Hi [GUEST_NAME]! Happy to accommodate a late check-out until [TIME]. Please note we have another guest arriving that evening. Please return keys/lock the property as normal. Enjoy the extra rest!', usageCount: 97 },
  { id: 't3', name: 'Maintenance Acknowledgment', category: 'Support', content: 'Hi [GUEST_NAME], thank you for letting us know about [ISSUE]. I\'ve dispatched our maintenance team and they will arrive within [TIMEFRAME]. We sincerely apologize for the inconvenience — a [COMPENSATION] has been applied to your booking.', usageCount: 43 },
  { id: 't4', name: 'Review Request', category: 'Marketing', content: 'Hi [GUEST_NAME]! We hope you had an amazing stay at [PROPERTY]. We would love to hear your feedback — a quick review means the world to us and helps future guests. Thank you so much!', usageCount: 156 },
  { id: 't5', name: 'Local Recommendations', category: 'Experience', content: 'Hi [GUEST_NAME]! Here are our favourite local spots:\n\n🍽️ Restaurants: [RESTAURANT_LIST]\n🏔️ Activities: [ACTIVITY_LIST]\n🛒 Groceries: [STORE_NAME] is [DISTANCE] away\n\nHave an amazing time!', usageCount: 72 },
  { id: 't6', name: 'Early Check-in Request', category: 'Operations', content: 'Hi [GUEST_NAME]! We\'d love to accommodate early check-in. Subject to our cleaning team completing the turnover, we can offer [TIME] for an additional $[AMOUNT]. Shall I confirm this for you?', usageCount: 88 },
]

// ─── Integrations ─────────────────────────────────────────────────────────────
export const INTEGRATIONS: Integration[] = [
  { id: 'i1', name: 'Notion', status: 'connected', lastSync: format(subMinutes(new Date(), 8), 'HH:mm'), icon: 'N', description: 'Knowledge base, SOPs, and property guides synced automatically' },
  { id: 'i2', name: 'GoHighLevel (GHL)', status: 'connected', lastSync: format(subMinutes(new Date(), 15), 'HH:mm'), icon: 'G', description: 'CRM pipeline, lead nurture sequences, and booking conversion flows' },
  { id: 'i3', name: 'PriceLabs', status: 'connected', lastSync: format(subMinutes(new Date(), 4), 'HH:mm'), icon: 'PL', description: 'Dynamic pricing data source for all 8 properties across 3 markets' },
  { id: 'i4', name: 'Airbnb API', status: 'connected', lastSync: format(subMinutes(new Date(), 2), 'HH:mm'), icon: 'AB', description: 'Listing management, booking sync, and messaging integration' },
  { id: 'i5', name: 'VRBO / Expedia', status: 'connected', lastSync: format(subMinutes(new Date(), 12), 'HH:mm'), icon: 'VB', description: 'Multi-channel listing sync and booking management' },
  { id: 'i6', name: 'Hospitable', status: 'connected', lastSync: format(subMinutes(new Date(), 6), 'HH:mm'), icon: 'HO', description: 'Unified inbox and automation layer for guest communications' },
  { id: 'i7', name: 'Stripe', status: 'connected', lastSync: format(subMinutes(new Date(), 3), 'HH:mm'), icon: 'ST', description: 'Direct booking payment processing and damage deposit holds' },
  { id: 'i8', name: 'Apify Browser', status: 'disconnected', lastSync: format(subDays(new Date(), 1), 'HH:mm'), icon: 'AP', description: 'Browser automation for competitor scraping and listing analysis' },
]

// ─── Booking Sources ──────────────────────────────────────────────────────────
export const BOOKING_SOURCES: BookingSource[] = [
  { name: 'Airbnb', value: 48, color: '#FF5A5F' },
  { name: 'VRBO', value: 22, color: '#3D5AFE' },
  { name: 'Direct', value: 18, color: '#00E5FF' },
  { name: 'Booking.com', value: 8, color: '#003580' },
  { name: 'Other', value: 4, color: 'var(--t3)' },
]

// ─── WhatsApp Contacts ────────────────────────────────────────────────────────
export const WHATSAPP_CONTACTS: WhatsAppContact[] = [
  { id: 'w1', name: 'Sarah Mitchell', phone: '+1 604-555-0142', status: 'allowed', lastMessage: 'Where are the ski lockers?', messageCount: 8 },
  { id: 'w2', name: 'James Thornton', phone: '+1 416-555-0287', status: 'allowed', lastMessage: 'Can we get early check-in?', messageCount: 5 },
  { id: 'w3', name: 'Mike (Maintenance)', phone: '+1 604-555-0399', status: 'allowed', lastMessage: 'Hot tub fixed, test complete', messageCount: 42 },
  { id: 'w4', name: 'Elite Cleaning Co.', phone: '+1 604-555-0156', status: 'allowed', lastMessage: 'Turnover complete at Coal Harbour', messageCount: 127 },
  { id: 'w5', name: 'Unknown Caller', phone: '+1 778-555-9023', status: 'blocked', lastMessage: 'Are you the owner?', messageCount: 3 },
  { id: 'w6', name: 'Ava Williams', phone: '+1 403-555-0744', status: 'allowed', lastMessage: 'Thank you for sorting the tub!', messageCount: 11 },
]

// ─── Slack Channels ───────────────────────────────────────────────────────────
export const SLACK_CHANNELS: SlackChannel[] = [
  { id: 's1', name: '#cortex-alerts', purpose: 'Real-time CORTEX system alerts and agent notifications', memberCount: 4, connected: true, lastActivity: format(subMinutes(new Date(), 3), 'HH:mm') },
  { id: 's2', name: '#revenue-daily', purpose: 'Daily pricing updates and revenue performance summaries', memberCount: 3, connected: true, lastActivity: format(subHours(new Date(), 2), 'HH:mm') },
  { id: 's3', name: '#guest-escalations', purpose: 'High-priority guest issues requiring human intervention', memberCount: 5, connected: true, lastActivity: format(subMinutes(new Date(), 45), 'HH:mm') },
  { id: 's4', name: '#operations', purpose: 'Maintenance tasks, cleaning schedules and property updates', memberCount: 8, connected: true, lastActivity: format(subHours(new Date(), 1), 'HH:mm') },
  { id: 's5', name: '#analytics-reports', purpose: 'Weekly and monthly performance reports delivery channel', memberCount: 3, connected: false, lastActivity: format(subDays(new Date(), 2), 'MMM dd') },
]

// ─── Orchestration Log ────────────────────────────────────────────────────────
export const ORCHESTRATION_LOG = Array.from({ length: 50 }, (_, i) => ({
  id: `orch-${i}`,
  cycle: 1847 - i,
  timestamp: format(subMinutes(new Date(), i * 3.5), 'HH:mm:ss'),
  agentsInvoked: Math.floor(Math.random() * 4) + 1,
  tasksProcessed: Math.floor(Math.random() * 8) + 1,
  duration: `${(Math.random() * 6 + 0.8).toFixed(1)}s`,
  status: Math.random() > 0.05 ? 'success' : 'warning',
  summary: [
    'Revenue sync + Guest reply + Ops task dispatch',
    'Email triage (12 emails) + Price adjustment x3',
    'Guest pre-arrival messages sent to 2 upcoming guests',
    'Competitor analysis + Listing score check',
    'Maintenance ticket created + cleaning scheduled',
    'Weekly report compilation started',
    'Dynamic pricing rules evaluated for weekend surge',
  ][Math.floor(Math.random() * 7)],
}))
