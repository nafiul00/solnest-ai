/**
 * AirDNA Tools (Phase 4 — Scaffold)
 *
 * Playwright-based scraper for AirDNA market data.
 * Same persistent-context pattern as PriceLabs.
 *
 * Requires authenticated session:
 *   node setup-auth.js --site airdna
 *
 * CSS selectors are placeholders — need live session verification.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', 'auth-data', 'airdna');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

fs.mkdirSync(REPORTS_DIR, { recursive: true });

// Singleton browser instance
let _browser = null;
let _page = null;

async function getBrowser() {
  if (!_browser) {
    if (!fs.existsSync(AUTH_DIR)) {
      throw new Error(
        'No AirDNA auth session found. Run: node setup-auth.js --site airdna\n' +
        'Then log into your AirDNA account and close the browser.'
      );
    }
    _browser = await chromium.launchPersistentContext(AUTH_DIR, {
      headless: true,
      viewport: { width: 1280, height: 900 },
    });
    _page = _browser.pages()[0] || await _browser.newPage();
  }
  return { browser: _browser, page: _page };
}

async function closeBrowser() {
  if (_browser) {
    try {
      await _browser.close();
    } catch {
      // Browser may already be closed or crashed
    }
    _browser = null;
    _page = null;
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { await closeBrowser(); process.exit(0); });
}

// ── MCP Server ──────────────────────────────────────────────────────────────

export function createAirDNAServer() {
  return createSdkMcpServer({
    name: 'airdna-market',
    version: '1.0.0',
    tools: [
      tool(
        'scrape_airdna_market',
        'Scrape AirDNA market overview for a location. Returns ADR, occupancy, RevPAR, supply/demand metrics. Requires authenticated session.',
        {
          market: z.string().describe('Market search term (e.g. "Sun Peaks, BC" or "Prince George, BC")'),
        },
        async ({ market }) => {
          try {
            const { page } = await getBrowser();

            // Navigate to AirDNA market overview
            // TODO: verify URL pattern with live session
            const searchUrl = `https://app.airdna.co/data/overview?location=${encodeURIComponent(market)}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(5000);

            // Extract market metrics
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

              const getPercent = (selector) => {
                const text = getText(selector);
                if (!text) return null;
                const num = parseFloat(text.replace(/[^0-9.]/g, ''));
                return isNaN(num) ? null : num;
              };

              return {
                // TODO: verify selector with live session
                market_adr: getNumber('[data-testid="adr-metric"]'),
                // TODO: verify selector with live session
                market_occupancy: getPercent('[data-testid="occupancy-metric"]'),
                // TODO: verify selector with live session
                market_revpar: getNumber('[data-testid="revpar-metric"]'),
                // TODO: verify selector with live session
                active_listings: getNumber('[data-testid="listings-count"]'),
                // TODO: verify selector with live session
                avg_daily_demand: getNumber('[data-testid="demand-metric"]'),
                // TODO: verify selector with live session
                avg_daily_supply: getNumber('[data-testid="supply-metric"]'),
                // TODO: verify selector with live session
                revenue_growth_yoy: getPercent('[data-testid="revenue-growth"]'),
                // Fallback: grab page text for manual parsing
                page_text: document.body.innerText.substring(0, 3000),
              };
            });

            // Take a screenshot for reference
            const screenshotPath = path.join(REPORTS_DIR,
              `airdna_${market.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  market,
                  metrics,
                  screenshot: screenshotPath,
                  note: 'CSS selectors are placeholders — verify with live AirDNA session',
                }, null, 2),
              }],
            };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),

      tool(
        'discover_airdna_comps',
        'Search AirDNA for comparable properties in a market by bedroom count and property type. Requires authenticated session.',
        {
          market: z.string().describe('Market location (e.g. "Sun Peaks, BC")'),
          bedrooms: z.coerce.number().int().nonnegative().describe('Number of bedrooms to filter by'),
          property_type: z.string().optional().describe('Property type filter (e.g. "Entire home", "Private room")'),
        },
        async ({ market, bedrooms, property_type }) => {
          try {
            const { page } = await getBrowser();

            // Navigate to AirDNA property search/comps page
            // TODO: verify URL pattern with live session
            const searchUrl = `https://app.airdna.co/data/rentalizer?location=${encodeURIComponent(market)}&bedrooms=${bedrooms}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(5000);

            // Apply property type filter if specified
            if (property_type) {
              // TODO: verify filter interaction with live session
              try {
                const filterButton = page.locator('button:has-text("Property Type")').first();
                await filterButton.click();
                await page.waitForTimeout(1000);
                const option = page.locator(`text="${property_type}"`).first();
                await option.click();
                await page.waitForTimeout(2000);
              } catch {
                // Filter might not exist or have different UI
              }
            }

            // Extract comp listings
            // TODO: verify all selectors with live session — these are placeholders
            const comps = await page.evaluate(() => {
              // TODO: verify selector with live session
              const rows = document.querySelectorAll('[data-testid="listing-row"], .listing-card, tr.comp-row');
              const listings = [];

              rows.forEach(row => {
                listings.push({
                  // TODO: verify selectors with live session
                  title: row.querySelector('[data-testid="listing-title"], .listing-title, td:nth-child(1)')?.textContent?.trim(),
                  adr: row.querySelector('[data-testid="listing-adr"], .listing-adr, td:nth-child(2)')?.textContent?.trim(),
                  occupancy: row.querySelector('[data-testid="listing-occupancy"], .listing-occupancy, td:nth-child(3)')?.textContent?.trim(),
                  revenue: row.querySelector('[data-testid="listing-revenue"], .listing-revenue, td:nth-child(4)')?.textContent?.trim(),
                  rating: row.querySelector('[data-testid="listing-rating"], .listing-rating, td:nth-child(5)')?.textContent?.trim(),
                });
              });

              return listings.filter(l => l.title);
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  market,
                  bedrooms,
                  property_type: property_type || 'all',
                  comps,
                  comps_found: comps.length,
                  note: 'CSS selectors are placeholders — verify with live AirDNA session',
                }, null, 2),
              }],
            };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),

      tool(
        'close_airdna_browser',
        'Close the AirDNA browser session. Call this when done scraping.',
        {},
        async () => {
          try {
            await closeBrowser();
            return { content: [{ type: 'text', text: 'AirDNA browser closed.' }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error closing browser: ${e.message}` }], isError: true };
          }
        }
      ),
    ],
  });
}
