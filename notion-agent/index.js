/**
 * Notion Agent — Entry Point
 *
 * Pushes property metrics, weekly reports, and guest communication logs
 * to client Notion workspaces on a daily/weekly schedule.
 *
 * Usage:
 *   npm start                     — start scheduler (daily + weekly cron)
 *   npm run sync                  — run daily sync now
 *   npm run sync:weekly           — run daily + weekly sync now
 *   node index.js --run-now       — run daily sync now
 *   node index.js --run-now --weekly  — run all syncs now
 */

import 'dotenv/config';
import { loadAllConfigs, getAllConfigs, getConfig } from './config/loader.js';
import { startScheduler, stopScheduler, runNow } from './lib/scheduler.js';
import { healthCheck } from './lib/notion.js';

async function main() {
  console.log('[NotionAgent] Starting...');

  // Verify Notion connection
  const health = await healthCheck();
  if (health.status !== 'ok') {
    console.error(`[NotionAgent] Notion API check failed: ${health.message}`);
    console.error('[NotionAgent] Check your NOTION_TOKEN in .env');
    process.exit(1);
  }
  console.log(`[NotionAgent] Notion connected as: ${health.user}`);

  // Load client configs
  loadAllConfigs();
  const configs = getAllConfigs();

  if (configs.length === 0) {
    console.error('[NotionAgent] No client configs found. Run: node setup.js --client <name> --notion-token <token>');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const isRunNow = args.includes('--run-now');
  const isWeekly = args.includes('--weekly');
  const clientArg = args.find((_, i) => args[i - 1] === '--client');

  if (isRunNow) {
    // Manual trigger — run syncs immediately
    const targetConfigs = clientArg ? [getConfig(clientArg)].filter(Boolean) : configs;

    if (targetConfigs.length === 0) {
      console.error(`[NotionAgent] Client "${clientArg}" not found`);
      process.exit(1);
    }

    for (const config of targetConfigs) {
      const results = await runNow(config, { weekly: isWeekly });
      console.log(`[NotionAgent] Results for ${config.client_id}:`, JSON.stringify(results, null, 2));
    }

    console.log('[NotionAgent] Manual sync complete');
    process.exit(0);
  }

  // Start scheduled mode
  startScheduler();
  console.log('[NotionAgent] Scheduler running. Press Ctrl+C to stop.');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[NotionAgent] Shutting down...');
    stopScheduler();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[NotionAgent] Received SIGTERM, shutting down...');
    stopScheduler();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('[NotionAgent] Fatal error:', err);
  process.exit(1);
});
