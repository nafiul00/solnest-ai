/**
 * Python Revenue Engine Bridge
 *
 * HTTP client that calls the Python revenue engine (serve.py).
 * Translates scraped PriceLabs data into the PropertyData schema
 * and returns structured pricing decisions.
 */

import 'dotenv/config';

const PYTHON_URL = process.env.PYTHON_ENGINE_URL || 'http://localhost:5050';
const TIMEOUT_MS = 30000;

/**
 * Check if the Python revenue engine is running.
 * @returns {Promise<{status: string}>}
 */
export async function healthCheck() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${PYTHON_URL}/health`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Health check failed: ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send property data to the Python revenue engine for analysis.
 *
 * @param {Object} propertyData — JSON matching the PropertyData schema:
 *   {
 *     property_id: string,
 *     base_price: number,
 *     calendar: [{ date, is_booked, price, booked_on? }],
 *     last_year_calendar: [{ date, is_booked, price, booked_on? }],
 *     comp_set: [{ date, avg_price, avg_occupancy, is_fully_booked? }],
 *     events: [{ date, name, demand_level }],
 *     analysis_date?: string (ISO)
 *   }
 *
 * @returns {Promise<Object>} — Revenue engine output (decisions, metrics, summary)
 */
export async function analyzeProperty(propertyData) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${PYTHON_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(propertyData),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Python engine error (${res.status}): ${body}`);
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Python engine returned invalid JSON (${text.length} chars): ${text.substring(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Transform PriceLabs scraped data into the PropertyData format
 * expected by the Python revenue engine.
 *
 * @param {Object} property — Entry from properties.js
 * @param {Object} scrapedData — Data from pricelabs-tools.js scraping
 * @returns {Object} — PropertyData-compatible JSON
 */
export function transformToPropertyData(property, scrapedData) {
  const today = new Date();
  const calendar = [];
  const lastYearCalendar = [];

  // Build a 30-day calendar from scraped data or defaults
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    // Use scraped base price if available, otherwise default
    const basePrice = scrapedData.prices?.base || 200;

    calendar.push({
      date: dateStr,
      is_booked: false, // PriceLabs scraping doesn't give booking status directly
      price: basePrice,
      booked_on: null,
    });

    // Last year placeholder (same structure, slightly lower price)
    const ly = new Date(d);
    ly.setFullYear(ly.getFullYear() - 1);
    lastYearCalendar.push({
      date: ly.toISOString().split('T')[0],
      is_booked: false,
      price: Math.round(basePrice * 0.9),
      booked_on: null,
    });
  }

  return {
    property_id: property.name,
    base_price: scrapedData.prices?.base || 200,
    calendar,
    last_year_calendar: lastYearCalendar,
    comp_set: [],
    events: [],
    analysis_date: today.toISOString().split('T')[0],
  };
}
