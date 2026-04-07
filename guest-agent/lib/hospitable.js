/**
 * Hospitable API Client
 *
 * Handles all communication with Hospitable REST API v2.
 * Auth via Personal Access Token (PAT).
 * Docs: https://developer.hospitable.com/
 */

import 'dotenv/config';

const BASE_URL = 'https://public.api.hospitable.com/v2';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.HOSPITABLE_PAT}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const mergedHeaders = { ...headers(), ...(options.headers || {}) };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(url, { ...options, headers: mergedHeaders, signal: controller.signal });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Hospitable API ${res.status} on ${endpoint}: ${body}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Messages ────────────────────────────────────────────

/**
 * Fetch conversation thread messages.
 */
export async function fetchConversationHistory(conversationId, limit = 50) {
  return request(`/conversations/${conversationId}/messages?per_page=${limit}`);
}

/**
 * Send a message in a conversation thread.
 */
export async function sendMessage(conversationId, content) {
  return request(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body: content }),
  });
}

// ── Properties ──────────────────────────────────────────

/**
 * List all properties in the account.
 */
export async function listProperties() {
  return request('/properties');
}

/**
 * Get a single property by ID.
 */
export async function fetchProperty(propertyId) {
  return request(`/properties/${propertyId}`);
}

// ── Reservations ────────────────────────────────────────

/**
 * Get reservation details (guest name, dates, guest count).
 */
export async function fetchReservation(reservationId) {
  return request(`/reservations/${reservationId}`);
}

/**
 * List reservations for a property.
 */
export async function listReservations(propertyId, status = 'accepted') {
  return request(`/properties/${propertyId}/reservations?filter[status]=${status}`);
}

// ── Health Check ────────────────────────────────────────

/**
 * Verify Hospitable API is reachable and PAT is valid.
 */
export async function healthCheck() {
  try {
    await request('/properties?per_page=1');
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}
