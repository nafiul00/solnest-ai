/**
 * Hospitable API Tools (Phase 2)
 *
 * MCP tools that pull booking history, revenue data, calendar availability,
 * and reviews from the Hospitable REST API v2.
 *
 * Base URL: https://public.api.hospitable.com/v2
 * Auth: Bearer token via HOSPITABLE_PAT env var
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import 'dotenv/config';

const BASE_URL = 'https://public.api.hospitable.com/v2';

// Rate limiter — 1 request per second to respect API limits
let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1000) {
    await new Promise(r => setTimeout(r, 1000 - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Make an authenticated request to the Hospitable API.
 */
async function hospitable(endpoint) {
  const pat = process.env.HOSPITABLE_PAT;
  if (!pat) {
    throw new Error('HOSPITABLE_PAT not set. Add it to your .env file.');
  }

  await rateLimit();

  const url = `${BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Hospitable API ${res.status} on ${endpoint}: ${body}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch all pages from a paginated Hospitable endpoint.
 */
async function fetchAllPages(endpoint) {
  const items = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const data = await hospitable(`${endpoint}${separator}per_page=${perPage}&page=${page}`);

    // Hospitable wraps results in a "data" key
    const results = data.data || data;
    if (Array.isArray(results)) {
      items.push(...results);
    } else {
      // Single object response, not paginated
      return results;
    }

    // Check if there are more pages
    const meta = data.meta;
    if (!meta || !meta.last_page || page >= meta.last_page) {
      break;
    }
    page++;
  }

  return items;
}

// ── Tool Implementations ────────────────────────────────────────────────────

async function getProperty(hospitableId) {
  const data = await hospitable(`/properties/${hospitableId}`);
  const prop = data.data || data;

  return {
    id: prop.id,
    name: prop.name || prop.internal_name,
    address: prop.address,
    bedrooms: prop.bedrooms,
    bathrooms: prop.bathrooms,
    accommodates: prop.accommodates || prop.person_capacity,
    property_type: prop.property_type,
    check_in_time: prop.check_in_time,
    check_out_time: prop.check_out_time,
    amenities: prop.amenities,
    listing_urls: prop.listing_urls || prop.listings,
  };
}

async function getReservations(hospitableId, status = 'accepted') {
  const endpoint = `/properties/${hospitableId}/reservations?filter[status]=${status}`;
  const reservations = await fetchAllPages(endpoint);

  if (!Array.isArray(reservations)) return [];

  return reservations.map(r => ({
    id: r.id,
    check_in: (r.check_in || r.arrival_date || '').slice(0, 10),
    check_out: (r.check_out || r.departure_date || '').slice(0, 10),
    nights: r.nights || daysBetween((r.check_in || r.arrival_date || '').slice(0, 10), (r.check_out || r.departure_date || '').slice(0, 10)),
    total: r.total_price || r.payout || r.revenue,
    currency: r.currency || 'CAD',
    status: r.status,
    guest_name: r.guest?.name || r.guest_name || 'Unknown',
    source: r.source || r.channel || 'airbnb',
    created_at: r.created_at,
    booked_at: r.booked_at || r.created_at,
  }));
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const d1 = new Date(start);
  const d2 = new Date(end);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

async function getCalendar(hospitableId) {
  // Build calendar from reservations + blocked dates
  // Sequential calls to respect rate limiter (no Promise.all — avoids race condition)
  const accepted = await getReservations(hospitableId, 'accepted');
  const blocked = await getReservations(hospitableId, 'blocked').catch(() => []);

  const today = new Date();
  const calendar = [];

  for (let i = 0; i < 90; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Check if this date falls within any reservation
    const booking = accepted.find(r => dateStr >= r.check_in && dateStr < r.check_out);
    const block = blocked.find(r => dateStr >= r.check_in && dateStr < r.check_out);

    if (booking) {
      calendar.push({
        date: dateStr,
        status: 'booked',
        reservation_id: booking.id,
        guest: booking.guest_name,
      });
    } else if (block) {
      calendar.push({
        date: dateStr,
        status: 'blocked',
        reservation_id: block.id,
      });
    } else {
      calendar.push({
        date: dateStr,
        status: 'available',
      });
    }
  }

  // Compute pacing stats
  const bookedNext30 = calendar.slice(0, 30).filter(d => d.status === 'booked').length;
  const bookedNext60 = calendar.slice(0, 60).filter(d => d.status === 'booked').length;
  const bookedNext90 = calendar.filter(d => d.status === 'booked').length;
  const availableNext14 = calendar.slice(0, 14).filter(d => d.status === 'available').length;

  return {
    calendar,
    summary: {
      booked_next_30d: bookedNext30,
      booked_next_60d: bookedNext60,
      booked_next_90d: bookedNext90,
      available_next_14d: availableNext14,
      occupancy_next_30d: Math.round((bookedNext30 / 30) * 100),
      occupancy_next_90d: Math.round((bookedNext90 / 90) * 100),
    },
  };
}

async function getReviews(hospitableId) {
  // Try the reviews endpoint first; fall back to extracting from reservations
  try {
    const reviews = await fetchAllPages(`/properties/${hospitableId}/reviews`);
    if (Array.isArray(reviews)) {
      return reviews.map(r => ({
        id: r.id,
        rating: r.rating || r.overall_rating,
        text: r.text || r.comment || r.body,
        guest_name: r.guest?.name || r.reviewer_name || 'Guest',
        created_at: r.created_at,
        source: r.source || 'airbnb',
      }));
    }
    return [];
  } catch {
    // Reviews endpoint may not exist — return empty
    return [];
  }
}

async function getPacing(hospitableId) {
  // Fetch accepted reservations and compute pacing vs last year
  const reservations = await getReservations(hospitableId, 'accepted');

  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;

  // This year: next 30 days
  const in30d = new Date(now);
  in30d.setDate(now.getDate() + 30);
  const nowStr = now.toISOString().split('T')[0];
  const in30dStr = in30d.toISOString().split('T')[0];

  // Same 30-day window last year
  const lastYearNow = new Date(now);
  lastYearNow.setFullYear(lastYear);
  const lastYearIn30d = new Date(in30d);
  lastYearIn30d.setFullYear(lastYear);
  const lyNowStr = lastYearNow.toISOString().split('T')[0];
  const lyIn30dStr = lastYearIn30d.toISOString().split('T')[0];

  let thisYearNights = 0;
  let lastYearNights = 0;
  let thisYearRevenue = 0;
  let lastYearRevenue = 0;

  for (const r of reservations) {
    if (!r.check_in || !r.check_out) continue;

    // This year window
    if (r.check_in < in30dStr && r.check_out > nowStr) {
      const overlapStart = r.check_in > nowStr ? r.check_in : nowStr;
      const overlapEnd = r.check_out < in30dStr ? r.check_out : in30dStr;
      const nights = daysBetween(overlapStart, overlapEnd);
      thisYearNights += nights;
      thisYearRevenue += (r.total || 0) * (nights / (r.nights || 1));
    }

    // Last year window
    if (r.check_in < lyIn30dStr && r.check_out > lyNowStr) {
      const overlapStart = r.check_in > lyNowStr ? r.check_in : lyNowStr;
      const overlapEnd = r.check_out < lyIn30dStr ? r.check_out : lyIn30dStr;
      const nights = daysBetween(overlapStart, overlapEnd);
      lastYearNights += nights;
      lastYearRevenue += (r.total || 0) * (nights / (r.nights || 1));
    }
  }

  const nightsDelta = lastYearNights > 0
    ? Math.round(((thisYearNights - lastYearNights) / lastYearNights) * 100 * 10) / 10
    : null;

  const revenueDelta = lastYearRevenue > 0
    ? Math.round(((thisYearRevenue - lastYearRevenue) / lastYearRevenue) * 100 * 10) / 10
    : null;

  return {
    this_year_booked_nights_30d: thisYearNights,
    last_year_booked_nights_30d: lastYearNights,
    nights_delta_percent: nightsDelta,
    this_year_revenue_30d: Math.round(thisYearRevenue),
    last_year_revenue_30d: Math.round(lastYearRevenue),
    revenue_delta_percent: revenueDelta,
  };
}

// ── MCP Server ──────────────────────────────────────────────────────────────

export function createHospitableServer() {
  return createSdkMcpServer({
    name: 'hospitable-api',
    version: '1.0.0',
    tools: [
      tool(
        'get_hospitable_property',
        'Fetch property details (name, address, bedrooms, amenities, check-in/out times) from Hospitable.',
        { hospitable_id: z.string().describe('Hospitable property UUID (from properties.js)') },
        async ({ hospitable_id }) => {
          try {
            const data = await getProperty(hospitable_id);
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),

      tool(
        'get_hospitable_reservations',
        'Fetch all reservations for a property including dates, revenue, guest info, and booking source. Supports status filter.',
        {
          hospitable_id: z.string().describe('Hospitable property UUID'),
          status: z.enum(['accepted', 'cancelled', 'pending', 'blocked']).optional()
            .describe('Filter by reservation status (default: accepted)'),
        },
        async ({ hospitable_id, status }) => {
          try {
            const data = await getReservations(hospitable_id, status || 'accepted');
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),

      tool(
        'get_hospitable_calendar',
        'Get calendar availability for the next 90 days (booked/available/blocked per date) with occupancy stats.',
        { hospitable_id: z.string().describe('Hospitable property UUID') },
        async ({ hospitable_id }) => {
          try {
            const data = await getCalendar(hospitable_id);
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),

      tool(
        'get_hospitable_reviews',
        'Fetch guest reviews and ratings for a property.',
        { hospitable_id: z.string().describe('Hospitable property UUID') },
        async ({ hospitable_id }) => {
          try {
            const data = await getReviews(hospitable_id);
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),

      tool(
        'get_hospitable_pacing',
        'Compare booking pace for the next 30 days vs same period last year. Shows booked nights and revenue deltas.',
        { hospitable_id: z.string().describe('Hospitable property UUID') },
        async ({ hospitable_id }) => {
          try {
            const data = await getPacing(hospitable_id);
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),
    ],
  });
}
