/**
 * activityLog.js
 * Circular buffer of the last 200 activity entries.
 * Emits `activity:new` via Socket.io whenever a new entry is added.
 */

import { v4 as uuid } from 'uuid'

const MAX_ENTRIES = 200
let io = null // injected by index.js

/** @type {import('../../cortex-dashboard/src/types/index').ActivityEntry[]} */
const entries = [
  {
    id: uuid(),
    timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
    agent: 'Revenue Agent',
    action: 'Adjusted Alpine Loft price +8% for weekend surge',
    property: 'Alpine Loft Whistler',
    level: 'success',
    detail: 'New nightly rate: $308. Occupancy threshold met.',
  },
  {
    id: uuid(),
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    agent: 'Guest Agent',
    action: 'Replied to Sarah M. regarding heating issue',
    property: 'Alpine Loft Whistler',
    level: 'info',
    detail: 'Advised guest to toggle thermostat override and escalated to Ops.',
  },
  {
    id: uuid(),
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    agent: 'Operations Agent',
    action: 'Created maintenance ticket for Blackcomb Chalet hot tub',
    property: 'Blackcomb Chalet',
    level: 'warning',
    detail: 'Ticket #481 opened. Technician scheduled for 09:00 tomorrow.',
  },
  {
    id: uuid(),
    timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
    agent: 'Marketing Agent',
    action: 'Pacific Rim Retreat listing score below threshold',
    property: 'Pacific Rim Retreat',
    level: 'warning',
    detail: 'Score: 72/100. Rewriting description to improve SEO ranking.',
  },
  {
    id: uuid(),
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    agent: 'Analytics Agent',
    action: 'Generated weekly market report for Whistler portfolio',
    property: undefined,
    level: 'success',
    detail: 'Average ADR up 6.2% vs prior week. Occupancy stable at 84%.',
  },
  {
    id: uuid(),
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    agent: 'Revenue Agent',
    action: 'Competitor rate check completed — all 8 properties',
    property: undefined,
    level: 'info',
    detail: '3 properties repriced. Total portfolio ADR: $312.',
  },
  {
    id: uuid(),
    timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    agent: 'Guest Agent',
    action: 'Check-in instructions sent to James Thornton',
    property: 'Coal Harbour Penthouse',
    level: 'success',
    detail: 'Early check-in confirmed for 12:00. Catering referrals included.',
  },
  {
    id: uuid(),
    timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
    agent: 'Operations Agent',
    action: 'Cleaning crew scheduled for Pacific Rim Retreat checkout',
    property: 'Pacific Rim Retreat',
    level: 'info',
    detail: 'Green Clean team confirmed for 11:00. Next guest checks in at 15:00.',
  },
]

export function setIo(socketIo) {
  io = socketIo
}

/**
 * Add a new activity entry. Emits `activity:new` to all connected clients.
 * @param {Omit<import('../../cortex-dashboard/src/types/index').ActivityEntry, 'id'>} entry
 * @returns {import('../../cortex-dashboard/src/types/index').ActivityEntry}
 */
export function addEntry(entry) {
  const full = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    ...entry,
  }
  entries.unshift(full)
  if (entries.length > MAX_ENTRIES) entries.splice(MAX_ENTRIES)
  if (io) io.emit('activity:new', full)
  return full
}

/**
 * Return the most recent N entries (default 50).
 * @param {number} limit
 * @returns {import('../../cortex-dashboard/src/types/index').ActivityEntry[]}
 */
export function getEntries(limit = 50) {
  return entries.slice(0, Math.min(limit, MAX_ENTRIES))
}
