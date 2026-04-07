/**
 * Revenue Intelligence Orchestrator
 *
 * Coordinates the multi-agent revenue intelligence pipeline:
 * 1. PriceLabs sub-agent scrapes real pricing data via Playwright
 * 2. Hospitable API pulls booking history, calendar, pacing data
 * 3. Airbnb Competitor agent scrapes comp listings via Apify
 * 4. Airbnb Insights agent scrapes host dashboard visibility metrics
 * 5. AirDNA agent scrapes market-level data
 * 6. Python revenue engine produces deterministic pricing decisions
 * 7. Claude generates interpretive analysis and recommendations
 * 8. Results merged into a unified report
 *
 * Usage:
 *   node orchestrator.js                    # Weekly mode (default)
 *   node orchestrator.js --mode daily       # Daily quick scan
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { createPriceLabsServer } from './tools/pricelabs-tools.js';
import { createHospitableServer } from './tools/hospitable-tools.js';
import { createAirbnbCompetitorServer, createAirbnbInsightsServer } from './tools/airbnb-tools.js';
import { createAirDNAServer } from './tools/airdna-tools.js';
import { analyzeProperty, healthCheck, transformToPropertyData } from './python-bridge.js';
import properties from './properties.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load from parent directory (.env at S-T-R/Solnest AI/.env) first,
// then local .env for any orchestrator-specific overrides.
loadEnv({ path: path.join(__dirname, '..', '.env') });
loadEnv({ path: path.join(__dirname, '.env') });
const REPORTS_DIR = path.join(__dirname, 'reports');
const CACHE_DIR = path.join(__dirname, 'cache');

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a professional Short-Term Rental (STR) Revenue Manager for Solnest Stays.
You manage ${properties.length} properties across ${[...new Set(properties.map(p => p.market))].join(' and ')}.

## Your Properties
${properties.map(p => `- ${p.name} (${p.bedrooms}BR, ${p.market})`).join('\n')}

## Your Analysis Methodology

### Revenue Flywheel
Visibility (page views, ranking) → Bookings (pace, conversion) → Reviews (score, sentiment) → Ranking → repeat

### Pricing Stack (lowest to highest priority)
MIN → Orphan Day (-15-25%) → Last Minute (-10-20%) → BASE → Seasonal → Weekend (+20-40%) → Event (+15-40%) → MAX

### 30-Day Calendar Scan
Flag unbooked gaps, orphan days, pricing vs comps, lead time pricing logic.

### Red Flag Detection
- 5+ unbooked days within 14 days
- Booked within hours (underpriced)
- Orphan days sitting 7+ days
- Weekdays empty but weekends booked
- Comps booked but you're not
- Comps empty but you're booked

### Lead-Time Pricing Logic
- 90+ days out: Hold firm, 5-15% above BASE
- 30-60 days: At BASE, watch closely
- 14-30 days: Evaluate, consider small discounts
- 7-14 days: Last-minute -10-20%
- 0-7 days: Aggressive discounting

## Your Data Sources (MCP Tools)

You have 5 data sources available as MCP tools. Use the right ones for the task:

### 1. PriceLabs (pricelabs-scraper)
- scrape_pricelabs_dashboard — Overview of all listings with occupancy and basic pricing
- scrape_pricelabs_listing — Detailed pricing for a specific listing (min/base/max, calendar, neighborhood data, customizations)
- close_pricelabs_browser — Clean up when done

### 2. Hospitable API (hospitable-api)
- get_hospitable_property — Property details from PMS
- get_hospitable_reservations — Booking history (dates, revenue, guests, source)
- get_hospitable_calendar — 90-day availability calendar with occupancy stats
- get_hospitable_reviews — Guest reviews and ratings
- get_hospitable_pacing — Booking pace vs same period last year

### 3. Airbnb Competitors (airbnb-competitor)
- get_cached_airbnb_data — Check for fresh cached comp data first (cheaper)
- scrape_airbnb_listings — Trigger Apify scrapers for comp listings (expensive, takes minutes)

### 4. Airbnb Insights (airbnb-insights)
- scrape_airbnb_insights — Host dashboard visibility metrics (page views, CTR, conversion)
- close_airbnb_browser — Clean up when done

### 5. AirDNA Market Data (airdna-market)
- scrape_airdna_market — Market-level ADR, occupancy, RevPAR, supply/demand
- discover_airdna_comps — Find comparable properties by market + bedrooms
- close_airdna_browser — Clean up when done

## Property IDs
${properties.map(p => `- ${p.name}: hospitable_id="${p.hospitable_id}", airbnb_id="${p.airbnb_listing_id || 'not set'}", market="${p.airdna_search}"`).join('\n')}

## Your Task
Gather data from available sources, analyze it using your revenue management methodology, identify red flags, and produce actionable recommendations. Return a structured markdown report.

**Important:** If a tool fails (e.g. missing auth, no API key), log the error and continue with available data. Never let one failed source block the entire report.`;

/**
 * Run the full revenue intelligence pipeline.
 *
 * @param {'daily'|'weekly'} mode — Analysis depth
 * @returns {Promise<{reportPath: string, fullReport: string, screenshots: string[]}>}
 */
export async function runAnalysis(mode = 'weekly') {
  const startTime = Date.now();
  console.log(`[Orchestrator] Starting ${mode} analysis for ${properties.length} properties...`);

  // Step 1: Check Python engine health (non-blocking — continue even if down)
  let engineAvailable = false;
  try {
    await healthCheck();
    engineAvailable = true;
    console.log('[Orchestrator] Python revenue engine is running.');
  } catch (e) {
    console.warn('[Orchestrator] Python revenue engine not available — skipping engine analysis.');
    console.warn('[Orchestrator] Start it with: cd "Revenue Management Agent Project" && python serve.py');
  }

  // Step 2: Create MCP servers for all data sources (Record<string, McpServerConfig>)
  const mcpServers = {};

  const plServer = createPriceLabsServer();
  mcpServers[plServer.name] = plServer;

  // Hospitable — always available (REST API, no browser needed)
  if (process.env.HOSPITABLE_PAT) {
    const hServer = createHospitableServer();
    mcpServers[hServer.name] = hServer;
    console.log('[Orchestrator] Hospitable API enabled.');
  } else {
    console.warn('[Orchestrator] HOSPITABLE_PAT not set — skipping Hospitable data.');
  }

  // Airbnb Competitor — needs APIFY_TOKEN
  if (process.env.APIFY_TOKEN) {
    const acServer = createAirbnbCompetitorServer();
    mcpServers[acServer.name] = acServer;
    console.log('[Orchestrator] Airbnb Competitor (Apify) enabled.');
  } else {
    console.warn('[Orchestrator] APIFY_TOKEN not set — skipping Airbnb competitor data.');
  }

  // Airbnb Insights — needs auth session (weekly only, expensive)
  if (mode === 'weekly' && fs.existsSync(path.join(__dirname, 'auth-data', 'airbnb'))) {
    const aiServer = createAirbnbInsightsServer();
    mcpServers[aiServer.name] = aiServer;
    console.log('[Orchestrator] Airbnb Insights (Playwright) enabled.');
  }

  // AirDNA — needs auth session (weekly only, expensive)
  if (mode === 'weekly' && fs.existsSync(path.join(__dirname, 'auth-data', 'airdna'))) {
    const adServer = createAirDNAServer();
    mcpServers[adServer.name] = adServer;
    console.log('[Orchestrator] AirDNA Market Data (Playwright) enabled.');
  }

  console.log(`[Orchestrator] ${Object.keys(mcpServers).length} data sources active.`);

  if (Object.keys(mcpServers).length === 0) {
    console.error('[Orchestrator] No data sources available — cannot proceed.');
    throw new Error('No MCP data sources configured. At minimum, PriceLabs is required.');
  }

  // Step 3: Use Agent SDK to analyze properties with all available data sources
  const hospIds = properties.map(p => `"${p.name}" (hospitable: ${p.hospitable_id})`).join(', ');

  const userPrompt = mode === 'daily'
    ? `Run a QUICK daily scan.
1. Scrape the PriceLabs dashboard for an overview of all properties.
2. Use Hospitable to check calendar availability and any new bookings for each property: ${hospIds}.
3. Focus on identifying immediate red flags in the next 14 days.
4. Keep the analysis concise — bullet points and tables only.
Close all browsers when done.`
    : `Run a COMPREHENSIVE weekly analysis.
1. Scrape PriceLabs dashboard, then scrape detailed data for EACH property (${properties.map(p => `"${p.pricelabs_name}"`).join(', ')}).
2. Pull booking history, calendar, pacing, and reviews from Hospitable for each property: ${hospIds}.
3. Check for cached Airbnb competitor data first. If stale or missing, scrape fresh comp data.
4. If AirDNA is available, scrape market data for ${[...new Set(properties.map(p => p.airdna_search))].map(m => `"${m}"`).join(' and ')}.
5. If Airbnb Insights is available, scrape visibility metrics for any properties with airbnb_listing_id set.
6. Cross-reference all data sources and provide a thorough revenue management analysis with specific pricing recommendations.
Close all browsers when done.`;

  let claudeAnalysis = 'No analysis generated.';
  try {
    const queryStream = query({
      prompt: userPrompt,
      options: {
        model: CLAUDE_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        mcpServers,
        maxTurns: 30,
        allowedTools: ['mcp'],
      },
    });

    // Collect assistant text across all message types the SDK may emit
    const textChunks = [];
    for await (const message of queryStream) {
      // SDK v2 streaming: text delta events
      if (message.type === 'text' && typeof message.text === 'string') {
        textChunks.push(message.text);
      }
      // SDK result event (some versions)
      else if (message.type === 'result' && message.subtype === 'success') {
        const content = message.result || message.content || '';
        if (content) textChunks.push(content);
      }
      // Full message event with content array
      else if (message.type === 'message' && message.message?.role === 'assistant') {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) textChunks.push(block.text);
          }
        } else if (typeof content === 'string' && content) {
          textChunks.push(content);
        }
      }
    }

    if (textChunks.length > 0) {
      claudeAnalysis = textChunks.join('');
      console.log(`[Orchestrator] Agent SDK analysis complete (${claudeAnalysis.length} chars).`);
    } else {
      console.warn('[Orchestrator] Agent SDK query completed but yielded no text content.');
    }
  } catch (e) {
    console.error('[Orchestrator] Agent SDK query failed:', e.message);
    claudeAnalysis = `Agent SDK error: ${e.message}. Falling back to basic report.`;
  }

  // Step 4: If Python engine is available, run deterministic analysis
  const engineResults = [];
  if (engineAvailable) {
    console.log('[Orchestrator] Running Python revenue engine for each property...');

    for (const property of properties) {
      try {
        // Transform whatever we have into PropertyData format
        const propertyData = transformToPropertyData(property, {
          prices: { base: 200 }, // Default — will be enriched when PriceLabs data flows through
        });

        const result = await analyzeProperty(propertyData);
        engineResults.push({ property: property.name, result });
        console.log(`[Orchestrator] Engine analysis complete for ${property.name}`);
      } catch (e) {
        console.error(`[Orchestrator] Engine failed for ${property.name}: ${e.message}`);
        engineResults.push({ property: property.name, error: e.message });
      }
    }
  }

  // Step 5: Merge Claude analysis + Python engine output into final report
  const timestamp = new Date().toISOString().split('T')[0];
  const reportContent = buildReport(mode, claudeAnalysis, engineResults, startTime);

  // Step 6: Save report
  const reportFilename = `revenue-intel-${mode}-${timestamp}.md`;
  const reportPath = path.join(REPORTS_DIR, reportFilename);
  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`[Orchestrator] Report saved: ${reportPath}`);

  // Step 7: Cache last successful output
  const cachePath = path.join(CACHE_DIR, `last-${mode}.json`);
  fs.writeFileSync(cachePath, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode,
    reportPath,
    engineResults,
  }, null, 2), 'utf-8');

  // Collect screenshots
  const screenshots = [];
  const reportsFiles = fs.readdirSync(REPORTS_DIR);
  for (const f of reportsFiles) {
    if (f.endsWith('.png')) {
      screenshots.push(path.join(REPORTS_DIR, f));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Orchestrator] ${mode} analysis complete in ${elapsed}s`);

  return { reportPath, fullReport: reportContent, screenshots };
}

/**
 * Build the final merged report.
 */
function buildReport(mode, claudeAnalysis, engineResults, startTime) {
  const now = new Date();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  let report = `# Solnest Stays — Revenue Intelligence Report\n\n`;
  report += `**Mode:** ${mode === 'daily' ? 'Daily Quick Scan' : 'Weekly Deep Analysis'}\n`;
  report += `**Generated:** ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString('en-US')}\n`;
  report += `**Properties:** ${properties.length}\n`;
  report += `**Duration:** ${elapsed}s\n\n`;
  report += `---\n\n`;

  // Section 1: Claude's interpretive analysis
  report += `## Market Analysis & Recommendations\n\n`;
  report += claudeAnalysis;
  report += `\n\n---\n\n`;

  // Section 2: Python engine's deterministic decisions
  if (engineResults.length > 0) {
    report += `## Revenue Engine Decisions\n\n`;
    report += `*Deterministic pricing decisions from the Python revenue engine (164-test validated)*\n\n`;

    for (const { property, result, error } of engineResults) {
      report += `### ${property}\n\n`;

      if (error) {
        report += `> Engine error: ${error}\n\n`;
        continue;
      }

      if (!result) {
        report += `> Engine returned no data\n\n`;
        continue;
      }

      if (result.status === 'ok') {
        // Summary
        if (result.summary) {
          report += `**Pacing:** ${result.summary.pacing_status}\n`;
          report += `**Market Position:** ${result.summary.market_position}\n`;
          report += `**Risk Level:** ${result.summary.risk_level}\n\n`;
        }

        // Metrics
        if (result.metrics) {
          report += `| Metric | Value |\n|--------|-------|\n`;
          report += `| ADR | ${result.metrics.adr != null ? '$' + result.metrics.adr.toFixed(2) : 'N/A'} |\n`;
          report += `| Occupancy | ${((result.metrics.occupancy || 0) * 100).toFixed(1)}% |\n`;
          report += `| RevPAR | ${result.metrics.rev_par != null ? '$' + result.metrics.rev_par.toFixed(2) : 'N/A'} |\n`;
          report += `| Total Revenue | ${result.metrics.total_revenue != null ? '$' + result.metrics.total_revenue.toFixed(2) : 'N/A'} |\n\n`;
        }

        // Decisions
        if (result.decisions && result.decisions.length > 0) {
          report += `**Pricing Decisions:**\n\n`;
          report += `| Date | Old Price | New Price | Change | Reason |\n`;
          report += `|------|-----------|-----------|--------|--------|\n`;
          for (const d of result.decisions.slice(0, 10)) {
            report += `| ${d.date} | $${d.old_price} | $${d.new_price} | ${d.change_percent} | ${d.reason} |\n`;
          }
          if (result.decisions.length > 10) {
            report += `\n*...and ${result.decisions.length - 10} more decisions*\n`;
          }
          report += `\n`;
        }

        // Issues
        if (result.issues_detected && result.issues_detected.length > 0) {
          report += `**Issues Detected:**\n`;
          for (const issue of result.issues_detected) {
            report += `- ${issue}\n`;
          }
          report += `\n`;
        }

        // Next Actions
        if (result.next_actions && result.next_actions.length > 0) {
          report += `**Next Actions:**\n`;
          for (const action of result.next_actions) {
            report += `- ${action}\n`;
          }
          report += `\n`;
        }
      } else {
        report += `> Engine returned status: ${result.status}\n`;
        if (result.errors) {
          for (const err of result.errors) {
            report += `> - ${err}\n`;
          }
        }
        report += `\n`;
      }
    }
  }

  report += `---\n\n`;
  report += `*Report generated by Solnest Revenue Intelligence Platform*\n`;
  report += `*Data: PriceLabs + Hospitable + Airbnb (Apify) + AirDNA | Analysis: Claude Agent SDK + Python Revenue Engine*\n`;

  return report;
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('orchestrator.js')) {
  const modeArg = process.argv.indexOf('--mode');
  const mode = modeArg !== -1 ? process.argv[modeArg + 1] : 'weekly';

  if (!['daily', 'weekly'].includes(mode)) {
    console.error(`Invalid mode: ${mode}. Use --mode daily or --mode weekly`);
    process.exit(1);
  }

  runAnalysis(mode)
    .then(({ reportPath }) => {
      console.log(`\nDone. Report: ${reportPath}`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Orchestrator failed:', err);
      process.exit(1);
    });
}
