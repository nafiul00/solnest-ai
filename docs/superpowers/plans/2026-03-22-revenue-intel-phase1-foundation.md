# Revenue Intelligence Platform — Phase 1: Foundation + PriceLabs Agent

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the revenue-intel project, set up multi-site auth, build improved PriceLabs scraping as MCP tools, and create a working orchestrator that produces a basic report for all 4 properties.

**Architecture:** Claude Agent SDK orchestrator with one sub-agent (PriceLabs). The PriceLabs agent gets MCP tools wrapping Playwright scraping functions. The orchestrator delegates scraping to the sub-agent, receives structured data, and produces an analysis. This validates the full Agent SDK pipeline before adding more agents.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk`, `playwright`, `zod`, `node-cron`, `nodemailer`, `dotenv`

**Spec:** `docs/superpowers/specs/2026-03-22-revenue-intel-platform-design.md`

---

## Critical Review Fixes (apply during implementation)

These override specific code in the tasks below:

### 1. ESM, not CommonJS
The Agent SDK is ESM-only. Set `"type": "module"` in `package.json`. All files must use `import`/`export` instead of `require()`/`module.exports`. When implementing, convert all `require()` to `import` and `module.exports` to `export`.

### 2. `tool()` uses positional arguments, not object syntax
The correct SDK signature is:
```javascript
tool(name, description, inputSchemaShape, handler)
```
Where `inputSchemaShape` is a raw Zod shape (plain object), NOT `z.object({})`. Example:
```javascript
// WRONG:
tool({ name: 'foo', description: '...', schema: z.object({}), handler: async () => {} })

// CORRECT:
tool('foo', '...', {}, async () => {
  return { content: [{ type: 'text', text: 'result' }] };
})

// With params:
tool('bar', '...', { listing_name: z.string().describe('Name') }, async ({ listing_name }) => {
  return { content: [{ type: 'text', text: listing_name }] };
})
```

### 3. Add defensive directory creation
At the top of `orchestrator.js`, add:
```javascript
import fs from 'fs';
fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });
```

### 4. Add process cleanup for browser
In `pricelabs-tools.js`, add:
```javascript
process.on('exit', () => { if (_browser) _browser.close(); });
```

### 5. Validate .env at startup
In `index.js`, add early validation:
```javascript
const required = ['ANTHROPIC_API_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'REPORT_TO_EMAIL'];
for (const key of required) {
  if (!process.env[key]) { console.error(`Missing .env: ${key}`); process.exit(1); }
}
```

---

## File Structure

```
solnestai/revenue-intel/
  package.json                    # Dependencies and scripts
  .env                            # API keys, tokens, config
  .gitignore                      # Ignore auth-data, node_modules, .env
  properties.js                   # Property registry (cross-source ID mapping)
  setup-auth.js                   # Multi-site browser auth setup
  orchestrator.js                 # Agent SDK query() with sub-agent definitions
  index.js                        # Cron scheduler entry point
  email.js                        # Email report sender (adapted from pricelabs-agent)
  tools/
    pricelabs-tools.js            # MCP server with PriceLabs scraping tools
  auth-data/
    pricelabs/                    # (created by setup-auth, gitignored)
  cache/                          # Last successful agent outputs
  reports/                        # Generated reports
```

---

### Task 1: Scaffold Project

**Files:**
- Create: `solnestai/revenue-intel/package.json`
- Create: `solnestai/revenue-intel/.gitignore`
- Create: `solnestai/revenue-intel/.env`

- [ ] **Step 1: Create project directory and package.json**

```json
{
  "name": "revenue-intel",
  "version": "1.0.0",
  "description": "Multi-agent revenue intelligence for Solnest Stays",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "analyze": "node orchestrator.js",
    "setup": "node setup-auth.js",
    "test:pricelabs": "node -e \"require('./tools/pricelabs-tools').test()\""
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "playwright": "^1.49.0",
    "zod": "^3.22.0",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.0",
    "dotenv": "^16.4.0"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
auth-data/
.env
cache/
reports/*.md
reports/*.png
```

- [ ] **Step 3: Create .env from existing pricelabs-agent .env**

Copy values from `solnestai/pricelabs-agent/.env` and add new fields:

```
# Claude
ANTHROPIC_API_KEY=<copy from pricelabs-agent/.env>

# Gmail SMTP
GMAIL_USER=hello@solnestai.com
GMAIL_APP_PASSWORD=<copy from pricelabs-agent/.env>
REPORT_TO_EMAIL=hello@solnestai.com

# Hospitable API (Phase 2)
HOSPITABLE_PAT=

# Apify (Phase 3)
APIFY_TOKEN=<copy from solnestai/.env>

# Slack (Phase 5)
SLACK_WEBHOOK_URL=

# Schedule
DAILY_CRON=0 7 * * *
WEEKLY_CRON=0 8 * * 1

# PriceLabs
PRICELABS_URL=https://app.pricelabs.co/pricing
```

- [ ] **Step 4: Create directories**

Run: `mkdir -p auth-data cache reports tools`

- [ ] **Step 5: Install dependencies**

Run: `cd revenue-intel && npm install && npx playwright install chromium`

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore
git commit -m "feat: scaffold revenue-intel project"
```

---

### Task 2: Property Registry

**Files:**
- Create: `solnestai/revenue-intel/properties.js`

- [ ] **Step 1: Create properties.js with known data**

The PriceLabs names are known from the dashboard scrape. Hospitable UUIDs are visible in the PriceLabs dashboard links. Airbnb listing IDs and AirDNA search terms will be filled in later phases.

```javascript
/**
 * Property Registry
 *
 * Maps each property across all data sources.
 * This is the single source of truth for property identity.
 */

module.exports = [
  {
    name: 'Boho Bliss',
    market: 'Prince George',
    bedrooms: 1,
    pricelabs_name: 'Boho Bliss',
    hospitable_id: '6a9d3726-eace-483f-b3a7-531f1ff2839b',
    airbnb_listing_id: '', // Fill in Phase 3
    airdna_search: 'Prince George, BC',
  },
  {
    name: 'The Urban Nest',
    market: 'Prince George',
    bedrooms: 2,
    pricelabs_name: 'The Urban Nest',
    hospitable_id: '5dc8331d-70a9-4463-bedb-3118a13c103a',
    airbnb_listing_id: '', // Fill in Phase 3
    airdna_search: 'Prince George, BC',
  },
  {
    name: 'The Apres Arcade',
    market: 'Sun Peaks',
    bedrooms: 3,
    pricelabs_name: 'The Apres Arcade',
    hospitable_id: '9f337b4c-2673-4f67-a9ea-17d0a699c9c2',
    airbnb_listing_id: '', // Fill in Phase 3
    airdna_search: 'Sun Peaks, BC',
  },
  {
    name: 'The Sunburst Chalet in Sun Peaks',
    market: 'Sun Peaks',
    bedrooms: 4,
    pricelabs_name: 'The Sunburst Chalet in Sun Peaks',
    hospitable_id: '206de053-0f37-4d1c-9955-209b22e3d9c4',
    airbnb_listing_id: '', // Fill in Phase 3
    airdna_search: 'Sun Peaks, BC',
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add properties.js
git commit -m "feat: add property registry for cross-source mapping"
```

---

### Task 3: Multi-Site Auth Setup

**Files:**
- Create: `solnestai/revenue-intel/setup-auth.js`

Reference: `solnestai/pricelabs-agent/setup-auth.js` (existing pattern)

- [ ] **Step 1: Create setup-auth.js supporting --site flag**

```javascript
/**
 * Multi-Site Auth Setup
 *
 * Opens a browser for manual login and saves the session.
 * Usage:
 *   node setup-auth.js --site pricelabs
 *   node setup-auth.js --site airbnb
 *   node setup-auth.js --site airdna
 */

const { chromium } = require('playwright');
const path = require('path');

const SITES = {
  pricelabs: {
    url: 'https://app.pricelabs.co/signin',
    waitForUrl: '**/pricing**',
    name: 'PriceLabs',
  },
  airbnb: {
    url: 'https://www.airbnb.com/login',
    waitForUrl: '**/hosting/**',
    name: 'Airbnb',
  },
  airdna: {
    url: 'https://app.airdna.co/login',
    waitForUrl: '**/app/**',
    name: 'AirDNA',
  },
};

async function setupAuth(siteName) {
  const site = SITES[siteName];
  if (!site) {
    console.error(`Unknown site: ${siteName}`);
    console.error(`Available: ${Object.keys(SITES).join(', ')}`);
    process.exit(1);
  }

  const authDir = path.join(__dirname, 'auth-data', siteName);
  console.log(`Opening browser for ${site.name} login...`);
  console.log('Please log in manually. The session will be saved automatically.\n');

  const browser = await chromium.launchPersistentContext(authDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = browser.pages()[0] || await browser.newPage();
  await page.goto(site.url);

  console.log('Waiting for you to log in...');
  console.log('After you see the dashboard, press Ctrl+C to save and exit.\n');

  try {
    await page.waitForURL(site.waitForUrl, { timeout: 300000 });
    console.log(`Login successful! Session saved to ./auth-data/${siteName}/`);
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('Timeout waiting for login. Try running setup again.');
  }

  await browser.close();
  console.log('Done.');
}

// Parse --site argument
const siteArg = process.argv.find((a, i) => process.argv[i - 1] === '--site');
if (!siteArg) {
  console.error('Usage: node setup-auth.js --site <pricelabs|airbnb|airdna>');
  process.exit(1);
}

setupAuth(siteArg).catch(console.error);
```

- [ ] **Step 2: Copy existing PriceLabs auth-data**

Run: `cp -r ../pricelabs-agent/auth-data ./auth-data/pricelabs`

- [ ] **Step 3: Test that PriceLabs auth still works**

Run: `node setup-auth.js --site pricelabs` (should open browser with saved session)

- [ ] **Step 4: Commit**

```bash
git add setup-auth.js
git commit -m "feat: multi-site auth setup for PriceLabs, Airbnb, AirDNA"
```

---

### Task 4: PriceLabs MCP Tools

**Files:**
- Create: `solnestai/revenue-intel/tools/pricelabs-tools.js`

Reference: `solnestai/pricelabs-agent/analyze.js` (lines 21-136 for scraping logic)

This is the most complex task. We need to port the existing scraping into MCP tool format with improved selectors.

- [ ] **Step 1: Create pricelabs-tools.js with MCP server and scraping tools**

```javascript
/**
 * PriceLabs MCP Tools
 *
 * Provides Playwright-based scraping tools for PriceLabs.
 * Used by the PriceLabs sub-agent via the Agent SDK.
 */

const { createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');
const { z } = require('zod');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AUTH_DIR = path.join(__dirname, '..', 'auth-data', 'pricelabs');
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const PRICELABS_URL = process.env.PRICELABS_URL || 'https://app.pricelabs.co/pricing';

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
    await _browser.close();
    _browser = null;
    _page = null;
  }
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
    const screenshotPath = path.join(__dirname, '..', 'reports',
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
  } catch (e) {}

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
function createPriceLabsServer() {
  return createSdkMcpServer({
    name: 'pricelabs-scraper',
    version: '1.0.0',
    tools: [
      tool({
        name: 'scrape_pricelabs_dashboard',
        description: 'Scrape the PriceLabs pricing dashboard to get a list of all properties with their occupancy rates and basic pricing info.',
        schema: z.object({}),
        handler: async () => {
          try {
            const listings = await scrapeDashboard();
            return { content: [{ type: 'text', text: JSON.stringify(listings, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        },
      }),
      tool({
        name: 'scrape_pricelabs_listing',
        description: 'Scrape detailed pricing data for a specific listing including calendar, min/base/max prices, neighborhood data, and customizations.',
        schema: z.object({
          listing_name: z.string().describe('The name of the listing to scrape (e.g. "Boho Bliss")'),
        }),
        handler: async ({ listing_name }) => {
          try {
            const detail = await scrapeListingDetail(listing_name);
            return { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
          }
        },
      }),
      tool({
        name: 'close_pricelabs_browser',
        description: 'Close the PriceLabs browser session. Call this when done scraping.',
        schema: z.object({}),
        handler: async () => {
          await closeBrowser();
          return { content: [{ type: 'text', text: 'Browser closed.' }] };
        },
      }),
    ],
  });
}

// Export for testing and server creation
module.exports = { createPriceLabsServer };

// Standalone test
module.exports.test = async function () {
  console.log('Testing PriceLabs scraping...');
  const listings = await scrapeDashboard();
  console.log(`Found ${listings.length} listings:`, listings.map(l => l.name));

  if (listings.length > 0) {
    const detail = await scrapeListingDetail(listings[0].name);
    console.log(`Detail for ${listings[0].name}:`, JSON.stringify(detail, null, 2).substring(0, 500));
  }

  await closeBrowser();
  console.log('Test complete.');
};
```

- [ ] **Step 2: Test PriceLabs tools standalone**

Run: `node -e "require('./tools/pricelabs-tools').test()"`

Expected: Lists 4 properties, scrapes detail for first one, outputs JSON with prices and calendar data.

- [ ] **Step 3: Commit**

```bash
git add tools/pricelabs-tools.js
git commit -m "feat: PriceLabs MCP scraping tools with improved selectors"
```

---

### Task 5: Orchestrator with PriceLabs Agent

**Files:**
- Create: `solnestai/revenue-intel/orchestrator.js`

- [ ] **Step 1: Create orchestrator.js with Agent SDK query()**

```javascript
/**
 * Revenue Intelligence Orchestrator
 *
 * Uses Claude Agent SDK to coordinate sub-agents for data gathering
 * and produce revenue management analysis.
 */

const { query } = require('@anthropic-ai/claude-agent-sdk');
const { createPriceLabsServer } = require('./tools/pricelabs-tools');
const properties = require('./properties');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const REPORTS_DIR = path.join(__dirname, 'reports');
const CACHE_DIR = path.join(__dirname, 'cache');

// Revenue management methodology prompt (from training docs)
const ANALYSIS_SYSTEM_PROMPT = `You are an expert short-term rental revenue manager following the Revenue Manager Training methodology. You analyze pricing data from PriceLabs and produce actionable revenue management reports.

## Properties
${JSON.stringify(properties, null, 2)}

## Analysis Framework

For each property, analyze:

### 1. Pricing Stack Review
Evaluate: MIN → Orphan Day (-15-25%) → Last Minute (-10-20%) → BASE → Seasonal → Weekend (+20-40%) → Event (+15-40%) → MAX

### 2. 30-Day Calendar Scan
- Flag unbooked gaps (5+ consecutive days within 14 days = RED FLAG)
- Identify orphan days sitting 7+ days
- Check lead time pricing logic:
  - 90+ days out: hold firm, price 5-15% above base
  - 30-60 days: at base, watch closely
  - 14-30 days: evaluate, small drops if needed
  - 7-14 days: last-minute discounts 10-20%
  - 0-7 days: aggressive discounting

### 3. Red Flag Detection
- 5+ unbooked days within 14 days → price too high or visibility problem
- Booked within hours → underpriced, raise base + min
- Orphan day sitting 7+ days → drop min stay to 1, discount 15-25%
- All weekends booked, weekdays empty → drop weekday rates
- Comps booked, you're not → overpriced or listing issue

### 4. Recommendations
- Rank by revenue impact
- Specific from → to changes with reasoning
- Include listing optimization suggestions

## Output Format

For each property produce:
# [Property Name] — Revenue Report
**Date:** [today]
**Current Setup:** [min/base/max, bedroom count, market]
**Occupancy:** [7N / 30N / 60N]

## Pricing Stack Review
[Evaluate each layer]

## Calendar Analysis (Next 30 Days)
[Gaps, orphans, pricing issues]

## Red Flags
[Any detected issues with severity and recommended action]

## Top Recommendations (ranked by revenue impact)
1. [Most impactful] — from X → to Y, because Z
2. [Second most impactful]
3. [Third]

Be specific with numbers. Reference actual data from the scraping tools.`;

async function runAnalysis(mode = 'weekly') {
  console.log(`[${new Date().toISOString()}] Starting ${mode} revenue analysis...`);

  const priceLabsServer = createPriceLabsServer();

  const propertyNames = properties.map(p => p.name).join(', ');

  const prompt = mode === 'daily'
    ? `Run a daily quick scan. Scrape the PriceLabs dashboard and check the next 30 days for all properties (${propertyNames}). For each property, scrape the detailed view. Flag any red flags, orphan days, or pricing issues. Be concise — this is a daily alert, not a full report.`
    : `Run a full weekly revenue analysis. Scrape the PriceLabs dashboard, then scrape detailed data for each property (${propertyNames}). For each property, get the calendar, min/base/max prices, neighborhood data, and customizations. Then produce a comprehensive revenue management report following the analysis framework. Close the browser when done.`;

  const reportParts = [];

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        model: 'claude-sonnet-4-6',
        maxTurns: 30,
        maxBudgetUsd: 2.0,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        cwd: __dirname,
        tools: [],
        allowedTools: ['Agent', 'mcp__pricelabs-scraper__scrape_pricelabs_dashboard', 'mcp__pricelabs-scraper__scrape_pricelabs_listing', 'mcp__pricelabs-scraper__close_pricelabs_browser'],
        agents: {
          'pricelabs-agent': {
            description: 'Scrapes PriceLabs.co for pricing data, calendar availability, neighborhood comparisons, and applied customizations for all Solnest Stays properties.',
            prompt: 'You are a PriceLabs data extraction agent. Use the scraping tools to gather comprehensive pricing data for all requested properties. First scrape the dashboard to see all listings, then scrape each requested listing for detailed data. Return all gathered data in your final message. Close the browser when done.',
            tools: ['mcp__pricelabs-scraper__scrape_pricelabs_dashboard', 'mcp__pricelabs-scraper__scrape_pricelabs_listing', 'mcp__pricelabs-scraper__close_pricelabs_browser'],
            model: 'haiku',
            maxTurns: 20,
          },
        },
        mcpServers: {
          'pricelabs-scraper': priceLabsServer,
        },
      },
    })) {
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            reportParts.push(block.text);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Analysis error: ${error.message}`);
    throw error;
  }

  // Build the final report
  const timestamp = new Date().toISOString().split('T')[0];
  const fullReport = `# Solnest Stays — ${mode === 'daily' ? 'Daily Scan' : 'Weekly Revenue Report'}\n**Generated:** ${new Date().toLocaleString()}\n\n---\n\n${reportParts.join('\n\n')}`;

  // Save report
  const reportPath = path.join(REPORTS_DIR, `report-${timestamp}.md`);
  fs.writeFileSync(reportPath, fullReport);
  console.log(`Report saved: ${reportPath}`);

  // Cache successful output
  const cachePath = path.join(CACHE_DIR, 'pricelabs.json');
  fs.writeFileSync(cachePath, JSON.stringify({ scrapedAt: new Date().toISOString(), report: fullReport }));

  return { reportPath, fullReport };
}

// Allow running standalone
if (require.main === module) {
  const mode = process.argv.includes('--daily') ? 'daily' : 'weekly';
  runAnalysis(mode)
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
```

- [ ] **Step 2: Test orchestrator**

Run: `node orchestrator.js`

Expected: Agent SDK spawns PriceLabs sub-agent, scrapes all 4 listings, produces analysis report saved to `reports/`.

- [ ] **Step 3: Review report quality**

Read `reports/report-YYYY-MM-DD.md` and verify it contains actual scraped data (not placeholders) with revenue management methodology applied.

- [ ] **Step 4: Commit**

```bash
git add orchestrator.js
git commit -m "feat: orchestrator with PriceLabs sub-agent via Agent SDK"
```

---

### Task 6: Email Report Sender

**Files:**
- Create: `solnestai/revenue-intel/email.js`

Reference: `solnestai/pricelabs-agent/email.js`

- [ ] **Step 1: Create email.js adapted from existing**

```javascript
/**
 * Email Report Sender
 *
 * Sends revenue intelligence reports via Gmail SMTP.
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

async function sendReport(reportPath, fullReport, screenshots = []) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const attachments = [{ filename: path.basename(reportPath), path: reportPath }];
  for (const screenshot of screenshots) {
    if (screenshot && fs.existsSync(screenshot)) {
      attachments.push({ filename: path.basename(screenshot), path: screenshot });
    }
  }

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.REPORT_TO_EMAIL,
    subject: `Solnest Stays — Weekly Revenue Report — ${today}`,
    text: fullReport,
    html: `
      <h2>Solnest Stays — Weekly Revenue Report</h2>
      <p><strong>${today}</strong></p>
      <hr>
      <pre style="font-family: monospace; white-space: pre-wrap; font-size: 14px;">${fullReport}</pre>
      <hr>
      <p><em>Generated by Revenue Intelligence Platform</em></p>
    `,
    attachments,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Email sent: ${info.messageId}`);
  return info;
}

module.exports = { sendReport };
```

- [ ] **Step 2: Commit**

```bash
git add email.js
git commit -m "feat: email report sender for revenue intel"
```

---

### Task 7: Cron Scheduler (index.js)

**Files:**
- Create: `solnestai/revenue-intel/index.js`

Reference: `solnestai/pricelabs-agent/index.js`

- [ ] **Step 1: Create index.js with dual cron (daily + weekly)**

```javascript
/**
 * Revenue Intelligence — Scheduled Runner
 *
 * Daily at 7 AM: Quick scan → Slack alert
 * Weekly Monday 8 AM: Full analysis → Email report
 *
 * Usage:
 *   npm start                  — Start both schedulers
 *   node index.js --mode daily --now   — Run daily scan immediately
 *   node index.js --mode weekly --now  — Run weekly analysis immediately
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { runAnalysis } = require('./orchestrator');
const { sendReport } = require('./email');

const DAILY_CRON = process.env.DAILY_CRON || '0 7 * * *';
const WEEKLY_CRON = process.env.WEEKLY_CRON || '0 8 * * 1';

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(__dirname, 'agent.log'), line + '\n');
}

async function runDailyJob() {
  log('Starting daily quick scan...');
  try {
    const { reportPath, fullReport } = await runAnalysis('daily');
    // TODO Phase 5: Send Slack alert instead of email
    log('Daily scan complete.');
  } catch (error) {
    log(`DAILY ERROR: ${error.message}`);
  }
}

async function runWeeklyJob() {
  log('Starting weekly revenue analysis...');
  try {
    const { reportPath, fullReport } = await runAnalysis('weekly');
    log('Sending report via email...');
    await sendReport(reportPath, fullReport);
    log('Weekly report sent!');
  } catch (error) {
    log(`WEEKLY ERROR: ${error.message}`);
    try {
      await sendReport(
        path.join(__dirname, 'agent.log'),
        `Revenue analysis FAILED: ${error.message}\n\nCheck agent.log for details.`
      );
    } catch (emailErr) {
      log(`Failed to send error notification: ${emailErr.message}`);
    }
  }
}

// Validate cron expressions
if (!cron.validate(DAILY_CRON) || !cron.validate(WEEKLY_CRON)) {
  log('Invalid cron schedule');
  process.exit(1);
}

log('Revenue Intelligence Agent started');
log(`Daily scan: ${DAILY_CRON}`);
log(`Weekly report: ${WEEKLY_CRON}`);
log('Press Ctrl+C to stop\n');

cron.schedule(DAILY_CRON, runDailyJob, { timezone: 'America/Vancouver' });
cron.schedule(WEEKLY_CRON, runWeeklyJob, { timezone: 'America/Vancouver' });

// Handle --now flag
const mode = process.argv.find((a, i) => process.argv[i - 1] === '--mode');
if (process.argv.includes('--now') && mode) {
  log(`Running ${mode} immediately (--now flag)...`);
  if (mode === 'daily') runDailyJob();
  else if (mode === 'weekly') runWeeklyJob();
}

process.on('SIGINT', () => {
  log('Agent stopped by user');
  process.exit(0);
});
```

- [ ] **Step 2: Test weekly analysis end-to-end**

Run: `node index.js --mode weekly --now`

Expected: Orchestrator runs, PriceLabs agent scrapes, report generated, email sent.

- [ ] **Step 3: Commit**

```bash
git add index.js
git commit -m "feat: dual cron scheduler for daily scan + weekly report"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Run full weekly analysis**

Run: `cd revenue-intel && node index.js --mode weekly --now`

Verify:
1. PriceLabs sub-agent scrapes all 4 listings
2. Report saved to `reports/report-YYYY-MM-DD.md`
3. Email received at hello@solnestai.com
4. Report contains actual pricing data (not "N/A")
5. Revenue management methodology applied (pricing stack, red flags, recommendations)

- [ ] **Step 2: Check report quality**

Read the generated report. Verify each property section has:
- Min/base/max prices (actual numbers)
- Occupancy rates
- Calendar analysis
- At least 2 specific recommendations

- [ ] **Step 3: Fix any issues found in verification**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 complete — revenue-intel with PriceLabs agent"
```

---

## What's Next

After Phase 1 is verified:
- **Phase 2:** Add Hospitable Agent (REST API — booking history, financials)
- **Phase 3:** Add Airbnb Agents (Competitor via Apify + Insights via Playwright)
- **Phase 4:** Add AirDNA Agent (market data, comp set discovery)
- **Phase 5:** Full orchestration, analysis prompt with all data sources, Slack alerts
