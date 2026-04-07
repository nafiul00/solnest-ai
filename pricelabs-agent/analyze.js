/**
 * PriceLabs Analyzer
 *
 * Scrapes PriceLabs dashboard and generates a pricing analysis report.
 * Uses Playwright with saved auth session to avoid manual login.
 *
 * Usage: node analyze.js
 */

const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const AUTH_DIR = path.join(__dirname, 'auth-data');
const REPORTS_DIR = path.join(__dirname, 'reports');
const PRICELABS_URL = process.env.PRICELABS_URL || 'https://app.pricelabs.co/pricing';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

// Validate required env vars at startup
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set in .env');
  process.exit(1);
}

// Create Anthropic client once (not per-listing)
const anthropic = new Anthropic();

async function scrapeListings(page) {
  await page.goto(PRICELABS_URL, { waitUntil: 'networkidle', timeout: 60000 });

  // Detect session expiry — PriceLabs redirects to /signin if logged out
  const currentUrl = page.url();
  if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
    throw new Error('PriceLabs session expired. Run: npm run setup');
  }

  // Wait for the table to load
  await page.waitForSelector('table', { timeout: 30000 });
  await page.waitForTimeout(3000); // Let data populate

  // Extract listing data from the table
  const listings = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const data = [];

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 10) return; // Skip loading rows

      const nameLink = row.querySelector('a[href*="open_calendar"]');
      const name = nameLink ? nameLink.textContent.trim() : '';
      if (!name) return;

      const href = nameLink ? nameLink.getAttribute('href') : '';

      // Extract text content from cells
      const cellTexts = Array.from(cells).map(c => c.textContent.trim());

      data.push({
        name,
        reviewUrl: href,
        fullRow: cellTexts.join(' | ')
      });
    });

    return data;
  });

  return listings;
}

async function scrapeListingDetail(page, listing) {
  // Validate reviewUrl before building selector — empty href matches everything
  if (!listing.reviewUrl) {
    console.error(`  Skipping "${listing.name}" — no review URL found`);
    return { calendarSnapshot: '', prices: {}, customizations: 'No review URL', neighborhoodSnapshot: '' };
  }

  // Click Review Prices to open the detail view
  const reviewButton = page.locator(`a[href*="${listing.reviewUrl}"]`).first();
  await reviewButton.click();
  await page.waitForTimeout(3000);

  const detail = {};

  // Get the full page snapshot text for Claude to analyze
  detail.calendarSnapshot = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog ? dialog.innerText : document.body.innerText;
  });

  // Get configure prices
  detail.prices = await page.evaluate(() => {
    const minInput = document.querySelector('input[name="min_price"]') ||
                     document.querySelector('[class*="min"] input[type="number"]');
    const baseInput = document.querySelector('input[name="base_price"]') ||
                      document.querySelector('[class*="base"] input[type="number"]');
    const maxInput = document.querySelector('input[name="max_price"]') ||
                     document.querySelector('[class*="max"] input[type="number"]');

    return {
      min: minInput ? minInput.value : 'N/A',
      base: baseInput ? baseInput.value : 'N/A',
      max: maxInput ? maxInput.value : 'N/A'
    };
  });

  // Click Neighborhood Data tab and take screenshot
  try {
    const ndTab = page.getByRole('tab', { name: 'Neighborhood Data' });
    await ndTab.click();
    await page.waitForTimeout(3000);

    // Cap filename length to avoid ENAMETOOLONG
    const safeName = listing.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100);
    const screenshotPath = path.join(REPORTS_DIR, `${safeName}_neighborhood.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    detail.neighborhoodScreenshot = screenshotPath;

    detail.neighborhoodSnapshot = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.innerText : '';
    });
  } catch (e) {
    console.error(`  Neighborhood Data tab failed for "${listing.name}": ${e.message}`);
    detail.neighborhoodSnapshot = 'Could not load neighborhood data';
  }

  // Go back to Calendar tab
  try {
    const calTab = page.getByRole('tab', { name: 'Calendar' });
    await calTab.click();
    await page.waitForTimeout(2000);
  } catch (e) {
    // Calendar tab navigation failed — recover by navigating back to dashboard
    console.error(`  Calendar tab failed for "${listing.name}": ${e.message}`);
    console.error('  Recovering — navigating back to dashboard...');
    await page.goto(PRICELABS_URL, { waitUntil: 'networkidle', timeout: 60000 });
    detail.calendarError = e.message;
    return detail;
  }

  // Click Applied Customizations to expand
  try {
    const custButton = page.locator('text=Applied Customizations').first();
    await custButton.click();
    await page.waitForTimeout(1500);

    detail.customizations = await page.evaluate(() => {
      const region = document.querySelector('[role="region"]');
      return region ? region.innerText : 'Could not load customizations';
    });
  } catch (e) {
    console.error(`  Applied Customizations failed for "${listing.name}": ${e.message}`);
    detail.customizations = 'Could not load customizations';
  }

  // Close the detail view — if back button fails, navigate directly to recover state
  try {
    const backButton = page.getByRole('button', { name: 'back-button' });
    await backButton.click();
    await page.waitForTimeout(2000);
  } catch (e) {
    console.error(`  Back button failed for "${listing.name}": ${e.message}`);
    console.error('  Recovering — navigating back to dashboard...');
    await page.goto(PRICELABS_URL, { waitUntil: 'networkidle', timeout: 60000 });
  }

  return detail;
}

async function generateAnalysis(listingData) {
  const prompt = `You are an expert PriceLabs pricing analyst for short-term rentals. Analyze this listing data and provide actionable recommendations to maximize revenue.

## Listing Data

${JSON.stringify(listingData, null, 2)}

## Instructions

Provide your analysis in this exact format:

# [Property Name] — Weekly Pricing Report

**Date:** ${new Date().toLocaleDateString()}
**Current Setup:** [details]
**Occupancy:** [7N / 30N / 60N]

## Market Position
Where does this listing sit relative to competitors? Above/below market median?

## Calendar Analysis
Flag any dates where pricing is significantly below market ADR (>15% gap).
Note any concerning occupancy trends.

## Customization Review
For each active rule, assess if it's helping or hurting revenue.
Format as a table: Rule | Current | Assessment | Recommendation

## Top Recommendations (ranked by revenue impact)
1. [Most impactful change]
2. [Second most impactful]
3. [Third]
4. [Fourth if applicable]

For each: what to change, from → to, and why.

## Risk Flags
Note anything concerning (prices hitting min floor too often, demand factor off, etc.)

Be specific with numbers. Don't be vague.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  if (!response.content || response.content.length === 0 || response.content[0].type !== 'text') {
    throw new Error(`Unexpected Claude response format: ${JSON.stringify(response.content)}`);
  }

  return response.content[0].text;
}

async function runAnalysis() {
  console.log(`[${new Date().toISOString()}] Starting PriceLabs analysis...`);

  // Ensure reports directory exists
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  // Check auth exists
  if (!fs.existsSync(AUTH_DIR)) {
    console.error('No auth session found. Run: npm run setup');
    process.exit(1);
  }

  const browser = await chromium.launchPersistentContext(AUTH_DIR, {
    headless: true,
    viewport: { width: 1280, height: 900 }
  });

  const page = browser.pages()[0] || await browser.newPage();

  try {
    // Get all listings
    console.log('Scraping dashboard...');
    const listings = await scrapeListings(page);
    console.log(`Found ${listings.length} listings`);

    // Guard against empty result (session expiry or DOM change)
    if (listings.length === 0) {
      throw new Error('No listings found — session may have expired or PriceLabs page structure changed. Run: npm run setup');
    }

    const reports = [];

    const errors = [];
    for (const listing of listings) {
      console.log(`Analyzing: ${listing.name}...`);
      try {
        // Scrape detail data
        const detail = await scrapeListingDetail(page, listing);

        // Generate AI analysis
        const analysis = await generateAnalysis({
          name: listing.name,
          dashboardRow: listing.fullRow,
          ...detail
        });

        reports.push({
          name: listing.name,
          analysis,
          neighborhoodScreenshot: detail.neighborhoodScreenshot
        });

        console.log(`  Done: ${listing.name}`);
      } catch (listingErr) {
        console.error(`  Failed for "${listing.name}": ${listingErr.message} — skipping, continuing with remaining listings`);
        errors.push({ listing: listing.name, error: listingErr.message });
        // Recover browser state by navigating back to dashboard
        try {
          await page.goto(PRICELABS_URL, { waitUntil: 'networkidle', timeout: 60000 });
        } catch {
          // If recovery also fails, the next listing will detect the issue
        }
      }
    }
    if (errors.length > 0) {
      console.warn(`\nCompleted with ${errors.length} listing error(s):`);
      errors.forEach(e => console.warn(`  - ${e.listing}: ${e.error}`));
    }

    // Save combined report
    const timestamp = new Date().toISOString().split('T')[0];
    const reportPath = path.join(REPORTS_DIR, `report-${timestamp}.md`);

    let fullReport = `# Solnest Stays — Weekly Pricing Report\n`;
    fullReport += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    fullReport += `---\n\n`;

    for (const report of reports) {
      fullReport += report.analysis + '\n\n---\n\n';
    }

    fs.writeFileSync(reportPath, fullReport);
    console.log(`Report saved: ${reportPath}`);

    return { reportPath, fullReport, reports };
  } finally {
    await browser.close();
  }
}

// Allow running standalone or as module
if (require.main === module) {
  runAnalysis()
    .then(({ reportPath }) => {
      console.log(`\nAnalysis complete! Report: ${reportPath}`);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runAnalysis };
