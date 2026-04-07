/**
 * Airbnb Tools (Phase 3)
 *
 * Two MCP servers:
 *
 * 1. Airbnb Competitor Agent (Apify actors)
 *    - Triggers room + review scrapers via Apify REST API
 *    - Merges results into structured comp data
 *    - Caches results to avoid re-triggering expensive runs
 *
 * 2. Airbnb Insights Agent (Playwright — scaffold)
 *    - Scrapes host dashboard for visibility metrics
 *    - Requires authenticated session (run setup-auth.js --site airbnb first)
 *    - CSS selectors need live verification
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const AUTH_DIR = path.join(__dirname, '..', 'auth-data', 'airbnb');

fs.mkdirSync(CACHE_DIR, { recursive: true });

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3A: Airbnb Competitor Tools (Apify)
// ═════════════════════════════════════════════════════════════════════════════

const APIFY_BASE = 'https://api.apify.com/v2';
const ACTORS = {
  rooms: 'tri_angle~airbnb-rooms-urls-scraper',
  reviews: 'tri_angle~airbnb-reviews-scraper',
};

/**
 * Make an authenticated request to the Apify API.
 */
async function apify(endpoint, options = {}) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error('APIFY_TOKEN not set. Add it to your .env file.');
  }

  const url = `${APIFY_BASE}${endpoint}`;
  const separator = url.includes('?') ? '&' : '?';

  const res = await fetch(`${url}${separator}token=${token}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Apify API ${res.status} on ${endpoint}: ${body}`);
  }

  return res.json();
}

/**
 * Trigger an Apify actor run with listing URLs.
 */
async function triggerActor(actorId, startUrls) {
  const data = await apify(`/acts/${actorId}/runs`, {
    method: 'POST',
    body: JSON.stringify({
      startUrls: startUrls.map(url => ({ url })),
    }),
  });

  const runId = data.data.id;
  console.log(`[Airbnb] Started ${actorId} run: ${runId}`);
  return runId;
}

/**
 * Poll until an Apify run finishes.
 * Max 30 minutes (180 polls * 10s).
 */
async function waitForRun(runId, maxPolls = 180, interval = 10000) {
  for (let i = 0; i < maxPolls; i++) {
    const data = await apify(`/actor-runs/${runId}`);
    const status = data.data.status;

    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED_OUT'].includes(status)) {
      console.log(`[Airbnb] Run ${runId} finished: ${status}`);
      return {
        status,
        datasetId: data.data.defaultDatasetId,
      };
    }

    console.log(`[Airbnb] Run ${runId}: ${status} — waiting ${interval / 1000}s...`);
    await new Promise(r => setTimeout(r, interval));
  }

  throw new Error(`Apify run ${runId} timed out after ${maxPolls * interval / 60000} minutes`);
}

/**
 * Fetch all items from an Apify dataset.
 */
async function fetchDataset(datasetId) {
  const data = await apify(`/datasets/${datasetId}/items?format=json`);
  // Apify returns the array directly for items endpoint
  const items = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
  if (!Array.isArray(items)) {
    console.warn(`[Airbnb] Dataset ${datasetId} returned unexpected format — treating as empty.`);
    return [];
  }
  console.log(`[Airbnb] Fetched ${items.length} items from dataset ${datasetId}`);
  return items;
}

/**
 * Extract listing ID from an Airbnb URL.
 * e.g. "https://www.airbnb.com/rooms/1492274390479279422?..." → "1492274390479279422"
 */
function extractListingId(url) {
  if (!url) return '';
  const match = url.match(/\/rooms\/(\d+)/);
  return match ? match[1] : '';
}

/**
 * Parse bedroom/bathroom counts from subDescription items.
 * e.g. ["7 guests", "3 bedrooms", "4 beds", "2 baths"] → { bedrooms: 3, bathrooms: 2 }
 */
function parseSubDescription(items) {
  const result = { bedrooms: null, bathrooms: null };
  if (!Array.isArray(items)) return result;
  for (const item of items) {
    const bedroomMatch = item.match(/(\d+)\s*bedroom/i);
    if (bedroomMatch) result.bedrooms = parseInt(bedroomMatch[1]);
    const bathMatch = item.match(/(\d+)\s*bath/i);
    if (bathMatch) result.bathrooms = parseInt(bathMatch[1]);
  }
  return result;
}

/**
 * Flatten amenities from Apify's nested category format to a flat array of strings.
 * Input: [{ title: "Bathroom", values: [{ title: "Bathtub", available: true }, ...] }, ...]
 * Output: ["Bathtub", "Hair dryer", ...]
 */
function flattenAmenities(amenities) {
  if (!Array.isArray(amenities)) return [];
  const flat = [];
  for (const category of amenities) {
    if (!category.values) continue;
    for (const item of category.values) {
      if (item.available !== false && item.title) {
        flat.push(item.title);
      }
    }
  }
  return flat;
}

/**
 * Merge room data with reviews by listing ID.
 * Ported from apify_trigger.py merge_results().
 *
 * Reviews link to listings via startUrl (not a listingId field).
 * Rooms have their ID at the top level as room.id.
 */
function mergeResults(rooms, reviews) {
  // Build reviews lookup by listing ID extracted from startUrl
  const reviewsByListing = {};
  for (const review of reviews) {
    // Reviews use startUrl to indicate which listing they belong to
    const listingId = extractListingId(review.startUrl) ||
      String(review.listingId || review.listing_id || review.roomId || '');
    if (!listingId) continue;
    if (!reviewsByListing[listingId]) reviewsByListing[listingId] = [];
    reviewsByListing[listingId].push({
      rating: review.rating ?? review.stars,
      text: review.text || review.localizedText || review.comments,
      guest_name: review.reviewer?.firstName || review.author || 'Guest',
      created_at: review.createdAt || review.date,
      response: review.response || null,
      language: review.language,
    });
  }

  // Merge reviews into room data
  return rooms.map(room => {
    const roomId = String(room.id || '');
    const urlId = extractListingId(room.url);
    const lookupId = roomId || urlId;
    const matchedReviews = reviewsByListing[lookupId] || [];

    // Parse bedroom/bath counts from subDescription
    const sub = parseSubDescription(room.subDescription?.items);

    return {
      id: lookupId,
      title: room.title || room.name,
      url: room.url,
      property_type: room.propertyType || room.roomType,
      person_capacity: room.personCapacity,
      bedrooms: sub.bedrooms,
      bathrooms: sub.bathrooms,
      rating: room.rating?.guestSatisfaction ?? null,
      review_count: room.rating?.reviewsCount ?? matchedReviews.length,
      host: {
        name: room.host?.name,
        is_superhost: room.host?.isSuperHost || false,
        rating: room.host?.ratingAverage,
      },
      amenities: flattenAmenities(room.amenities),
      location: {
        lat: room.coordinates?.latitude,
        lng: room.coordinates?.longitude,
        city: typeof room.location === 'string' ? room.location : null,
      },
      description_snippet: typeof room.description === 'string'
        ? room.description.substring(0, 300)
        : null,
      reviews: matchedReviews,
    };
  });
}

/**
 * Get cached Airbnb data if fresh (less than maxAge ms old).
 */
function getCachedData(maxAge = 24 * 60 * 60 * 1000) {
  const cacheFile = path.join(CACHE_DIR, 'airbnb-latest.json');
  if (!fs.existsSync(cacheFile)) return null;

  const stat = fs.statSync(cacheFile);
  const age = Date.now() - stat.mtimeMs;
  if (age > maxAge) return null;

  const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  data._cached = true;
  data._age_hours = Math.round(age / (60 * 60 * 1000) * 10) / 10;
  return data;
}

/**
 * Save data to cache.
 */
function saveCache(data) {
  const cacheFile = path.join(CACHE_DIR, 'airbnb-latest.json');
  fs.writeFileSync(cacheFile, JSON.stringify({
    ...data,
    _timestamp: new Date().toISOString(),
  }, null, 2), 'utf-8');
}

export function createAirbnbCompetitorServer() {
  return createSdkMcpServer({
    name: 'airbnb-competitor',
    version: '1.0.0',
    tools: [
      tool(
        'scrape_airbnb_listings',
        'Scrape Airbnb competitor listings using Apify actors. Triggers rooms + reviews scrapers, waits for completion, and returns merged data. This is expensive — check cache first with get_cached_airbnb_data.',
        {
          listing_urls: z.array(z.string()).describe(
            'Airbnb listing URLs to scrape (e.g. ["https://www.airbnb.com/rooms/12345"])'
          ),
        },
        async ({ listing_urls }) => {
          try {
            if (!listing_urls || listing_urls.length === 0) {
              return { content: [{ type: 'text', text: 'Error: No listing URLs provided.' }], isError: true };
            }

            // Trigger both actors in parallel
            console.log(`[Airbnb] Triggering scrapers for ${listing_urls.length} listings...`);
            const [roomsRunId, reviewsRunId] = await Promise.all([
              triggerActor(ACTORS.rooms, listing_urls),
              triggerActor(ACTORS.reviews, listing_urls),
            ]);

            // Wait for both to complete
            const [roomsResult, reviewsResult] = await Promise.all([
              waitForRun(roomsRunId),
              waitForRun(reviewsRunId),
            ]);

            // Fetch datasets
            let rooms = [];
            let reviews = [];

            if (roomsResult.status === 'SUCCEEDED' && roomsResult.datasetId) {
              rooms = await fetchDataset(roomsResult.datasetId);
            }
            if (reviewsResult.status === 'SUCCEEDED' && reviewsResult.datasetId) {
              reviews = await fetchDataset(reviewsResult.datasetId);
            }

            // Merge
            const merged = mergeResults(rooms, reviews);

            // Cache the results
            const result = {
              listings: merged,
              scrape_summary: {
                rooms_found: rooms.length,
                reviews_found: reviews.length,
                listings_returned: merged.length,
                rooms_run_status: roomsResult.status,
                reviews_run_status: reviewsResult.status,
              },
            };
            saveCache(result);

            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),

      tool(
        'get_cached_airbnb_data',
        'Get cached Airbnb competitor data if available and fresh (less than 24 hours old). Use this before triggering an expensive Apify scrape.',
        {},
        async () => {
          try {
            const cached = getCachedData();
            if (!cached) {
              return { content: [{ type: 'text', text: JSON.stringify({ cached: false, message: 'No fresh cache available. Use scrape_airbnb_listings to fetch new data.' }) }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),
    ],
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3B: Airbnb Insights Tools (Playwright — Scaffold)
// ═════════════════════════════════════════════════════════════════════════════

// Singleton browser instance for Airbnb host dashboard
let _airbnbBrowser = null;
let _airbnbPage = null;

async function getAirbnbBrowser() {
  if (!_airbnbBrowser) {
    if (!fs.existsSync(AUTH_DIR)) {
      throw new Error(
        'No Airbnb auth session found. Run: node setup-auth.js --site airbnb\n' +
        'Then log into your Airbnb host account and close the browser.'
      );
    }
    _airbnbBrowser = await chromium.launchPersistentContext(AUTH_DIR, {
      headless: true,
      viewport: { width: 1280, height: 900 },
    });
    _airbnbPage = _airbnbBrowser.pages()[0] || await _airbnbBrowser.newPage();
  }
  return { browser: _airbnbBrowser, page: _airbnbPage };
}

async function closeAirbnbBrowser() {
  if (_airbnbBrowser) {
    try {
      await _airbnbBrowser.close();
    } catch {
      // Browser may already be closed or crashed
    }
    _airbnbBrowser = null;
    _airbnbPage = null;
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { await closeAirbnbBrowser(); process.exit(0); });
}

export function createAirbnbInsightsServer() {
  return createSdkMcpServer({
    name: 'airbnb-insights',
    version: '1.0.0',
    tools: [
      tool(
        'scrape_airbnb_insights',
        'Scrape Airbnb host dashboard for visibility and conversion metrics (page views, impressions, CTR, conversion rate, search ranking). Requires authenticated session.',
        {
          listing_id: z.string().describe('Airbnb listing ID (numeric, e.g. "1492274390479279422")'),
        },
        async ({ listing_id }) => {
          try {
            const { page } = await getAirbnbBrowser();

            // Navigate to the host dashboard insights page
            // TODO: verify URL path with live session
            const insightsUrl = `https://www.airbnb.com/hosting/listings/${listing_id}/performance`;
            await page.goto(insightsUrl, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(3000);

            // Extract visibility metrics
            // TODO: verify all selectors with live session — these are placeholders
            const metrics = await page.evaluate(() => {
              const getText = (selector) => {
                const el = document.querySelector(selector);
                return el ? el.textContent.trim() : null;
              };

              const getNumber = (selector) => {
                const text = getText(selector);
                if (!text) return null;
                const num = parseFloat(text.replace(/[^0-9.]/g, ''));
                return isNaN(num) ? null : num;
              };

              return {
                // TODO: verify selector with live session
                page_views: getNumber('[data-testid="page-views-value"]'),
                // TODO: verify selector with live session
                impressions: getNumber('[data-testid="impressions-value"]'),
                // TODO: verify selector with live session
                ctr: getNumber('[data-testid="ctr-value"]'),
                // TODO: verify selector with live session
                conversion_rate: getNumber('[data-testid="conversion-value"]'),
                // TODO: verify selector with live session
                booking_rate: getNumber('[data-testid="booking-rate-value"]'),
                // TODO: verify selector with live session
                average_daily_rate: getNumber('[data-testid="adr-value"]'),
                // Fallback: grab all visible numbers from the page
                page_text: document.body.innerText.substring(0, 2000),
              };
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  listing_id,
                  metrics,
                  note: 'CSS selectors are placeholders — verify with live Airbnb session',
                }, null, 2),
              }],
            };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),

      tool(
        'close_airbnb_browser',
        'Close the Airbnb browser session. Call this when done scraping insights.',
        {},
        async () => {
          try {
            await closeAirbnbBrowser();
            return { content: [{ type: 'text', text: 'Airbnb browser closed.' }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error closing browser: ${e.message}` }], isError: true };
          }
        }
      ),
    ],
  });
}
