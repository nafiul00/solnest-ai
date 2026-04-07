/**
 * Notion Agent — Client Setup Script
 *
 * Creates 3 Notion databases in a client's workspace and generates
 * the client config file.
 *
 * Usage:
 *   node setup.js --client solnest --notion-token "secret_xxx" --parent-page "page-id"
 *
 * The --parent-page is the Notion page ID where databases will be created.
 * (Create a page in Notion first, share it with the integration, and copy its ID from the URL.)
 *
 * Options:
 *   --client         Client ID (required)
 *   --client-name    Display name (defaults to titlecase of client ID)
 *   --notion-token   Notion integration token (or set NOTION_TOKEN env var)
 *   --parent-page    Notion page ID to create databases under (required)
 *   --pricelabs-dir  Path to revenue-intel reports (default: ../revenue-intel/reports)
 *   --guest-dir      Path to guest conversations (default: ../guest-agent/conversations/{client})
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@notionhq/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '').replace(/-/g, '_');
      parsed[key] = args[i + 1] || true;
      i++;
    }
  }

  return parsed;
}

function titleCase(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function sanitizeId(input) {
  if (!input || typeof input !== 'string') {
    console.error('Error: --client must be a non-empty string');
    process.exit(1);
  }
  const sanitized = input.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    console.error('Error: --client contains invalid characters (use alphanumeric, dash, underscore only)');
    process.exit(1);
  }
  return sanitized;
}

async function main() {
  const args = parseArgs();

  if (!args.client) {
    console.error('Usage: node setup.js --client <id> --parent-page <page-id> [--notion-token <token>]');
    process.exit(1);
  }

  if (!args.parent_page) {
    console.error('Error: --parent-page is required. Create a page in Notion, share it with the integration, and pass its ID.');
    console.error('(The page ID is the 32-char hex string in the Notion page URL.)');
    process.exit(1);
  }

  const notionToken = args.notion_token || process.env.NOTION_TOKEN;
  if (!notionToken) {
    console.error('Error: Notion token required. Pass --notion-token or set NOTION_TOKEN env var.');
    process.exit(1);
  }

  const clientId = sanitizeId(args.client);
  const clientName = args.client_name || titleCase(clientId);
  const parentPageId = args.parent_page;

  console.log(`\n[Setup] Creating Notion databases for: ${clientName}`);
  console.log(`[Setup] Parent page: ${parentPageId}\n`);

  const notion = new Client({ auth: notionToken });

  // ── 1. Property Performance Database ──────────────────

  console.log('[Setup] Creating Property Performance database...');
  const perfDb = await notion.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: 'text', text: { content: `${clientName} — Property Performance` } }],
    properties: {
      Property: { title: {} },
      Date: { date: {} },
      'Occupancy Rate': { number: { format: 'percent' } },
      ADR: { number: { format: 'dollar' } },
      'Revenue (MTD)': { number: { format: 'dollar' } },
      RevPAR: { number: { format: 'dollar' } },
      'Avg Lead Time': { number: { format: 'number' } },
      'Comp Set Rank': {
        select: {
          options: [
            { name: 'Above Market', color: 'green' },
            { name: 'At Market', color: 'yellow' },
            { name: 'Below Market', color: 'red' },
          ],
        },
      },
      'Risk Flags': {
        multi_select: {
          options: [
            { name: 'Low Occupancy', color: 'red' },
            { name: 'Gap Days', color: 'orange' },
            { name: 'Min Floor Hit', color: 'yellow' },
            { name: 'Demand Factor Off', color: 'purple' },
            { name: 'Below Market', color: 'red' },
            { name: 'Orphan Days', color: 'pink' },
            { name: 'Review Needed', color: 'gray' },
          ],
        },
      },
      'Last Updated': { date: {} },
    },
  });
  console.log(`  Created: ${perfDb.id}`);

  // ── 2. Weekly Reports Database ────────────────────────

  console.log('[Setup] Creating Weekly Reports database...');
  const reportsDb = await notion.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: 'text', text: { content: `${clientName} — Weekly Reports` } }],
    properties: {
      Title: { title: {} },
      Property: {
        select: { options: [] }, // Options auto-populate on first use
      },
      Week: { date: {} },
      Status: {
        select: {
          options: [
            { name: 'Current', color: 'green' },
            { name: 'Archived', color: 'gray' },
          ],
        },
      },
      Summary: { rich_text: {} },
    },
  });
  console.log(`  Created: ${reportsDb.id}`);

  // ── 3. Guest Communication Log Database ───────────────

  console.log('[Setup] Creating Guest Communication Log database...');
  const guestDb = await notion.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: 'text', text: { content: `${clientName} — Guest Communication Log` } }],
    properties: {
      'Thread ID': { title: {} },
      Property: {
        select: { options: [] },
      },
      'Guest Name': { rich_text: {} },
      'Last Message': { date: {} },
      'Total Messages': { number: { format: 'number' } },
      Intent: {
        select: {
          options: [
            { name: 'faq', color: 'blue' },
            { name: 'booking_inquiry', color: 'green' },
            { name: 'complaint', color: 'red' },
            { name: 'emergency', color: 'red' },
            { name: 'modification', color: 'orange' },
            { name: 'checkout', color: 'yellow' },
            { name: 'pre_arrival', color: 'purple' },
            { name: 'spam', color: 'gray' },
          ],
        },
      },
      Escalated: { checkbox: {} },
      Status: {
        select: {
          options: [
            { name: 'Active', color: 'blue' },
            { name: 'Resolved', color: 'green' },
            { name: 'Escalated', color: 'red' },
          ],
        },
      },
      'AI Response Rate': { number: { format: 'percent' } },
    },
  });
  console.log(`  Created: ${guestDb.id}`);

  // ── 4. Generate Config File ───────────────────────────

  const priceLabsDir = args.pricelabs_dir || `../revenue-intel/reports`;
  const guestDir = args.guest_dir || `../guest-agent/conversations/${clientId}`;

  const config = {
    client_id: clientId,
    client_name: clientName,
    notion_databases: {
      property_performance: perfDb.id,
      weekly_reports: reportsDb.id,
      guest_log: guestDb.id,
    },
    data_sources: {
      pricelabs_reports: priceLabsDir,
      guest_conversations: guestDir,
    },
    properties: [],
    schedule: {
      daily_metrics: '0 6 * * *',
      weekly_report: '0 7 * * 1',
    },
  };

  const configDir = path.join(__dirname, 'config', 'clients');
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, `${clientId}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`\n[Setup] Config saved: ${configPath}`);
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Setup complete!');
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n  Notion databases created:`);
  console.log(`    Property Performance: ${perfDb.id}`);
  console.log(`    Weekly Reports:       ${reportsDb.id}`);
  console.log(`    Guest Log:            ${guestDb.id}`);
  console.log(`\n  Next steps:`);
  console.log(`    1. Add properties to: config/clients/${clientId}.json`);
  console.log(`       Example: { "slug": "boho-bliss", "name": "Boho Bliss" }`);
  console.log(`    2. Ensure data source paths are correct (pricelabs + guest-agent)`);
  console.log(`    3. Test: node index.js --run-now --client ${clientId}`);
  console.log(`    4. Start scheduler: npm start\n`);
}

main().catch(err => {
  console.error('[Setup] Error:', err.message);
  process.exit(1);
});
