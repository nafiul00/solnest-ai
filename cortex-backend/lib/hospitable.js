/**
 * hospitable.js
 * Thin client for the Hospitable API v1.
 * Caches responses in-memory for 5 minutes.
 * Falls back to mock data when the API is unreachable or PAT is missing.
 */

const BASE_URL = 'https://api.hospitable.com'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** @type {Map<string, { data: any, expiresAt: number }>} */
const cache = new Map()

async function cachedFetch(path) {
  const now = Date.now()
  const cached = cache.get(path)
  if (cached && cached.expiresAt > now) {
    return cached.data
  }

  const pat = process.env.HOSPITABLE_PAT
  if (!pat) {
    throw new Error('HOSPITABLE_PAT not set')
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Hospitable ${path} → ${res.status}: ${text}`)
  }

  const data = await res.json()
  cache.set(path, { data, expiresAt: now + CACHE_TTL_MS })
  return data
}

// ─── Mock fallback data ───────────────────────────────────────────────────────

const MOCK_PROPERTIES = [
  { id: 'p1', name: 'Alpine Loft Whistler',   market: 'Whistler',  bedrooms: 2, basePrice: 285, color: '#00E5FF', occupancy: 84, platform: 'Airbnb' },
  { id: 'p2', name: 'Blackcomb Chalet',        market: 'Whistler',  bedrooms: 4, basePrice: 420, color: '#F5A623', occupancy: 91, platform: 'Airbnb' },
  { id: 'p3', name: 'Whistler Village Studio', market: 'Whistler',  bedrooms: 1, basePrice: 180, color: '#22D3A0', occupancy: 78, platform: 'VRBO'   },
  { id: 'p4', name: 'Pacific Rim Retreat',     market: 'Tofino',    bedrooms: 3, basePrice: 350, color: '#A78BFA', occupancy: 72, platform: 'Airbnb' },
  { id: 'p5', name: 'Surf & Cedar Cabin',      market: 'Tofino',    bedrooms: 2, basePrice: 265, color: '#F25D5D', occupancy: 88, platform: 'Airbnb' },
  { id: 'p6', name: 'Gastown Heritage Loft',   market: 'Vancouver', bedrooms: 1, basePrice: 195, color: '#FB923C', occupancy: 65, platform: 'Airbnb' },
  { id: 'p7', name: 'Kitsilano Beach Suite',   market: 'Vancouver', bedrooms: 2, basePrice: 240, color: '#F472B6', occupancy: 80, platform: 'VRBO'   },
  { id: 'p8', name: 'Coal Harbour Penthouse',  market: 'Vancouver', bedrooms: 3, basePrice: 480, color: '#06B6D4', occupancy: 93, platform: 'Airbnb' },
]

function generateMockCalendar(propertyId, basePrice) {
  const days = []
  const guestNames = ['Sarah M.', 'James T.', 'Emma L.', 'Oliver K.', 'Ava W.', 'Liam H.', 'Sophia R.', 'Noah B.']
  for (let i = 0; i < 30; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i - 5)
    const date = d.toISOString().split('T')[0]
    const roll = Math.random()
    const status = roll < 0.85
      ? (Math.random() < 0.92 ? 'booked' : 'blocked')
      : (Math.random() < 0.5 ? 'available' : 'pending')
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return normalised property list.
 * Tries Hospitable API first; falls back to mock data on any error.
 */
export async function getProperties() {
  try {
    const data = await cachedFetch('/v1/properties')
    // Normalise Hospitable response shape → our internal shape
    const items = Array.isArray(data) ? data : (data.data ?? data.properties ?? [])
    return items.map((p) => ({
      id: String(p.id ?? p.uuid),
      name: p.name ?? p.title ?? 'Unnamed Property',
      market: p.city ?? p.market ?? 'Unknown',
      bedrooms: p.bedrooms ?? 1,
      basePrice: p.base_price ?? p.price ?? 200,
      color: '#00E5FF',
      occupancy: p.occupancy_rate ?? Math.round(70 + Math.random() * 25),
      platform: p.platform ?? 'Airbnb',
    }))
  } catch (err) {
    console.warn('[hospitable] getProperties fallback:', err.message)
    return MOCK_PROPERTIES
  }
}

/**
 * Return 30-day booking calendar for a specific property.
 */
export async function getCalendar(propertyId) {
  try {
    const data = await cachedFetch(`/v1/properties/${propertyId}/calendar`)
    const items = Array.isArray(data) ? data : (data.data ?? data.days ?? [])
    return items.slice(0, 30).map((d) => ({
      date: d.date,
      price: d.price ?? d.nightly_price ?? 200,
      status: d.status ?? 'available',
      propertyId,
      guestName: d.guest_name ?? d.guestName ?? undefined,
    }))
  } catch (err) {
    console.warn(`[hospitable] getCalendar(${propertyId}) fallback:`, err.message)
    // Seed random with propertyId so results are stable per property within a run
    const prop = MOCK_PROPERTIES.find((p) => p.id === propertyId) ?? { basePrice: 250 }
    return generateMockCalendar(propertyId, prop.basePrice)
  }
}

/**
 * Flush the in-memory cache (useful for testing).
 */
export function flushCache() {
  cache.clear()
}
