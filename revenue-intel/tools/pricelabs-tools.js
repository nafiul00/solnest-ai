/**
 * PriceLabs MCP Tools
 *
 * Provides Playwright-based scraping tools for PriceLabs.
 * Used by the PriceLabs sub-agent via the Agent SDK.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', 'auth-data', 'pricelabs');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const PRICELABS_URL = process.env.PRICELABS_URL || 'https://app.pricelabs.co/pricing';

// Ensure reports dir exists
fs.mkdirSync(REPORTS_DIR, { recursive: true });

// Singleton browser instance — shared across tool calls within one agent run
let _browser = null;
let _page = null;

async function getBrowser() {
  if (!_browser) {
    if (!fs.existsSync(AUTH_DIR)) {
      throw new Error('No PriceLabs auth session. Run: node setup-auth.js --site pricelabs');
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

// Tool: Scrape PriceLabs dashboard
async function scrapeDashboard() {
  const { page } = await getBrowser();
  await page.goto(PRICELABS_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('table', { timeout: 60000 });
  await page.waitForTimeout(3000);

  const listings = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const data = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 10) return;
      const nameLink = row.querySelector('a[href*="open_calendar"]');
      if (!nameLink) return;
      const name = nameLink.textContent.trim();
      const href = nameLink.getAttribute('href');
      const cellTexts = Array.from(cells).map(c => c.textContent.trim());
      data.push({ name, reviewUrl: href, cellTexts });
    });
    return data;
  });

  return listings;
}

// Tool: Scrape a single listing's detail view
async function scrapeListingDetail(listingName) {
  const { page } = await getBrowser();

  // Navigate to the listing's calendar view
  const listings = await scrapeDashboard();
  const listing = listings.find(l => l.name.includes(listingName));
  if (!listing) {
    return { error: `Listing "${listingName}" not found. Available: ${listings.map(l => l.name).join(', ')}` };
  }

  // Click Review Prices link
  const link = page.locator(`a[href*="${listing.reviewUrl}"]`).first();
  await link.click();
  await page.waitForTimeout(4000);

  const detail = {};

  // Extract calendar/pricing data from the dialog
  detail.calendarSnapshot = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog ? dialog.innerText : document.body.innerText;
  });

  // Extract min/base/max prices
  detail.prices = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="number"]');
    const labels = document.querySelectorAll('label');
    const prices = {};
    labels.forEach(label => {
      const text = label.textContent.toLowerCase();
      const input = label.closest('div')?.querySelector('input[type="number"]');
      if (input) {
        if (text.includes('min')) prices.min = parseInt(input.value) || null;
        if (text.includes('base')) prices.base = parseInt(input.value) || null;
        if (text.includes('max')) prices.max = parseInt(input.value) || null;
      }
    });
    // Fallback: try all number inputs if labels didn't work
    if (!prices.min && !prices.base && !prices.max && inputs.length >= 3) {
      const values = Array.from(inputs).map(i => parseInt(i.value)).filter(v => !isNaN(v));
      if (values.length >= 3) {
        prices.min = values[0];
        prices.base = values[1];
        prices.max = values[2];
      }
    }
    return prices;
  });

  // Click Neighborhood Data tab
  try {
    const ndTab = page.getByRole('tab', { name: 'Neighborhood Data' });
    await ndTab.click();
    await page.waitForTimeout(3000);

    detail.neighborhoodData = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.innerText : '';
    });

    // Take screenshot for reference
    const screenshotPath = path.join(REPORTS_DIR,
      `${listingName.replace(/[^a-zA-Z0-9]/g, '_')}_neighborhood.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    detail.neighborhoodScreenshot = screenshotPath;
  } catch (e) {
    detail.neighborhoodData = 'Could not load neighborhood data';
  }

  // Go back to Calendar tab
  try {
    const calTab = page.getByRole('tab', { name: 'Calendar' });
    await calTab.click();
    await page.waitForTimeout(2000);
  } catch (e) {
    console.error(`  Calendar tab navigation failed for "${listingName}": ${e.message}`);
    detail.calendarError = e.message;
  }

  // Click Applied Customizations
  try {
    const custButton = page.locator('text=Applied Customizations').first();
    await custButton.click();
    await page.waitForTimeout(1500);
    detail.customizations = await page.evaluate(() => {
      const region = document.querySelector('[role="region"]');
      return region ? region.innerText : 'Could not load customizations';
    });
  } catch (e) {
    detail.customizations = 'Could not load customizations';
  }

  // Close the detail view
  try {
    const backButton = page.getByRole('button', { name: 'back-button' });
    await backButton.click();
    await page.waitForTimeout(2000);
  } catch (e) {
    // Try pressing Escape as fallback
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  return { name: listingName, ...detail };
}

// Create the MCP server
export function createPriceLabsServer() {
  return createSdkMcpServer({
    name: 'pricelabs-scraper',
    version: '1.0.0',
    tools: [
      tool(
        'scrape_pricelabs_dashboard',
        'Scrape the PriceLabs pricing dashboard to get a list of all properties with their occupancy rates and basic pricing info.',
        {},
        async () => {
          try {
            const listings = await scrapeDashboard();
            return { content: [{ type: 'text', text: JSON.stringify(listings, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),
      tool(
        'scrape_pricelabs_listing',
        'Scrape detailed pricing data for a specific listing including calendar, min/base/max prices, neighborhood data, and customizations.',
        { listing_name: z.string().describe('The name of the listing to scrape (e.g. "Boho Bliss")') },
        async ({ listing_name }) => {
          try {
            const detail = await scrapeListingDetail(listing_name);
            return { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        }
      ),
      tool(
        'close_pricelabs_browser',
        'Close the PriceLabs browser session. Call this when done scraping.',
        {},
        async () => {
          await closeBrowser();
          return { content: [{ type: 'text', text: 'Browser closed.' }] };
        }
      ),
    ],
  });
}

// Standalone test
export async function test() {
  console.log('Testing PriceLabs scraping...');
  const listings = await scrapeDashboard();
  console.log(`Found ${listings.length} listings:`, listings.map(l => l.name));

  if (listings.length > 0) {
    const detail = await scrapeListingDetail(listings[0].name);
    console.log(`Detail for ${listings[0].name}:`, JSON.stringify(detail, null, 2).substring(0, 500));
  }

  await closeBrowser();
  console.log('Test complete.');
}
