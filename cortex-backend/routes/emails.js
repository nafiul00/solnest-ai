/**
 * routes/emails.js
 * GET   /api/emails       — fetch email triage queue (mock + Hospitable notifications)
 * PATCH /api/emails/:id   — update triage status / category
 */

import { Router } from 'express'
import { v4 as uuid } from 'uuid'

const router = Router()

// ─── In-memory triage store ───────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function hoursAgo(n) {
  return new Date(Date.now() - n * 3600000).toISOString()
}

function minsAgo(n) {
  return new Date(Date.now() - n * 60000).toISOString()
}

/** @type {Map<string, object>} */
const emailStore = new Map([
  ['e1', {
    id: 'e1',
    from: 'sarah.mitchell@gmail.com',
    subject: 'Heating issue in lower floor',
    preview: 'Hi again! The heating on the lower level is still acting up after we toggled the thermostat…',
    receivedAt: minsAgo(22),
    category: 'complaint',
    status: 'pending',
    priority: 'high',
    property: 'Alpine Loft Whistler',
  }],
  ['e2', {
    id: 'e2',
    from: 'james.thornton@company.io',
    subject: 'Catering recommendations + invoice query',
    preview: 'Thanks for confirming early check-in. Could you share 2–3 catering contacts for our team dinner?',
    receivedAt: minsAgo(47),
    category: 'inquiry',
    status: 'pending',
    priority: 'medium',
    property: 'Coal Harbour Penthouse',
  }],
  ['e3', {
    id: 'e3',
    from: 'airbnb-noreply@airbnb.com',
    subject: 'New booking: Pacific Rim Retreat Apr 18–22',
    preview: 'Congratulations! You have a new booking from Oliver K. Check-in Apr 18, 4 nights.',
    receivedAt: hoursAgo(1.5),
    category: 'booking',
    status: 'triaged',
    priority: 'medium',
    property: 'Pacific Rim Retreat',
  }],
  ['e4', {
    id: 'e4',
    from: 'reviews@airbnb.com',
    subject: 'Emma Liu left you a 5-star review',
    preview: '"Absolutely magical stay. The surf recommendations were perfect and the cabin itself is stunning."',
    receivedAt: hoursAgo(3),
    category: 'review',
    status: 'auto-resolved',
    priority: 'low',
    property: 'Pacific Rim Retreat',
  }],
  ['e5', {
    id: 'e5',
    from: 'maintenance@greenclean.ca',
    subject: 'Hot tub service quote — Blackcomb Chalet',
    preview: 'Hi, following up on ticket #481. Our tech can attend Thursday AM. Estimate: $220 for jet replacement.',
    receivedAt: hoursAgo(5),
    category: 'maintenance',
    status: 'triaged',
    priority: 'high',
    property: 'Blackcomb Chalet',
  }],
  ['e6', {
    id: 'e6',
    from: 'noreply@vrbo.com',
    subject: 'Inquiry: Whistler Village Studio — March 29–Apr 2',
    preview: 'Hi! We are a couple looking for a cozy studio in Whistler. Is your property available for 4 nights?',
    receivedAt: hoursAgo(7),
    category: 'inquiry',
    status: 'pending',
    priority: 'medium',
    property: 'Whistler Village Studio',
  }],
  ['e7', {
    id: 'e7',
    from: 'no-reply@pricelabs.co',
    subject: 'PriceLabs: 3 properties have suboptimal pricing',
    preview: 'Your properties Pacific Rim Retreat, Gastown Heritage Loft, and Whistler Village Studio have prices…',
    receivedAt: daysAgo(1),
    category: 'inquiry',
    status: 'triaged',
    priority: 'low',
    property: undefined,
  }],
  ['e8', {
    id: 'e8',
    from: 'offers@hotelpromotions.net',
    subject: 'Exclusive hotel supply deal — 60% off linens!',
    preview: 'Dear Property Manager, we have an exclusive offer for your hospitality business…',
    receivedAt: daysAgo(2),
    category: 'spam',
    status: 'auto-resolved',
    priority: 'low',
    property: undefined,
  }],
  ['e9', {
    id: 'e9',
    from: 'urgent@airbnb.com',
    subject: 'Action required: Guest safety concern at Surf & Cedar',
    preview: 'A guest has reported a potential safety concern at your property. Immediate response required.',
    receivedAt: minsAgo(8),
    category: 'urgent',
    status: 'escalated',
    priority: 'high',
    property: 'Surf & Cedar Cabin',
  }],
])

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/emails
router.get('/', (req, res) => {
  const { status, priority, category } = req.query
  let list = [...emailStore.values()]

  if (status) list = list.filter((e) => e.status === status)
  if (priority) list = list.filter((e) => e.priority === priority)
  if (category) list = list.filter((e) => e.category === category)

  // Sort: newest first
  list.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))

  res.json({ emails: list, total: list.length })
})

// PATCH /api/emails/:id
router.patch('/:id', (req, res) => {
  const email = emailStore.get(req.params.id)
  if (!email) return res.status(404).json({ error: 'Email not found' })

  const allowedStatus = ['pending', 'triaged', 'escalated', 'auto-resolved']
  const allowedCategory = ['booking', 'complaint', 'inquiry', 'maintenance', 'review', 'spam', 'urgent']
  const allowedPriority = ['high', 'medium', 'low']

  const updates = {}
  if (req.body.status && allowedStatus.includes(req.body.status)) updates.status = req.body.status
  if (req.body.category && allowedCategory.includes(req.body.category)) updates.category = req.body.category
  if (req.body.priority && allowedPriority.includes(req.body.priority)) updates.priority = req.body.priority

  const updated = { ...email, ...updates }
  emailStore.set(req.params.id, updated)
  res.json({ email: updated })
})

export default router
