/**
 * Revenue Intelligence Scheduler
 *
 * Dual cron scheduler for automated revenue analysis:
 * - Daily (7 AM): Quick scan → Slack alert
 * - Weekly (Monday 8 AM): Deep analysis → Email report
 *
 * Usage:
 *   node index.js                           # Start scheduler
 *   node index.js --mode daily --now        # Run daily immediately + start scheduler
 *   node index.js --mode weekly --now       # Run weekly immediately + start scheduler
 */

import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

// Load from the parent directory (.env at S-T-R/Solnest AI/.env) first,
// then fall back to a local .env in this directory for module-specific overrides.
const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__moduleDir, '..', '.env') });
loadEnv({ path: path.join(__moduleDir, '.env') });

import { runAnalysis } from './orchestrator.js';
import { sendReport } from './email.js';
import { sendSlackAlert } from './slack.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, 'agent.log');

let DAILY_CRON = process.env.DAILY_CRON || '0 7 * * *';
let WEEKLY_CRON = process.env.WEEKLY_CRON || '0 8 * * 1';

// ── Logging ──────────────────────────────────────────────────────────────────

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);

  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    // Disk full or permissions — don't crash the scheduler
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateEnv() {
  const required = ['ANTHROPIC_API_KEY'];
  const missing = required.filter(k => !process.env[k]);

  if (missing.length > 0) {
    log(`FATAL: Missing required env vars: ${missing.join(', ')}`);
    log('Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }

  // Validate cron expressions — fall back to defaults if invalid
  if (!cron.validate(DAILY_CRON)) {
    log(`WARNING: Invalid DAILY_CRON expression: "${DAILY_CRON}" — using default "0 7 * * *"`);
    DAILY_CRON = '0 7 * * *';
  }
  if (!cron.validate(WEEKLY_CRON)) {
    log(`WARNING: Invalid WEEKLY_CRON expression: "${WEEKLY_CRON}" — using default "0 8 * * 1"`);
    WEEKLY_CRON = '0 8 * * 1';
  }
}

// ── Job Runners ──────────────────────────────────────────────────────────────

async function runDailyJob() {
  log('── Daily quick scan starting ──');
  try {
    const { fullReport } = await runAnalysis('daily');
    await sendSlackAlert(fullReport);
    log('── Daily quick scan complete ──');
  } catch (err) {
    log(`Daily job failed: ${err.message}`);
    // Try to notify about the failure
    try {
      await sendSlackAlert(`Revenue Intel daily scan FAILED: ${err.message}`);
    } catch (notifyErr) {
      log(`Failed to send error notification: ${notifyErr.message}`);
    }
  }
}

async function runWeeklyJob() {
  log('── Weekly deep analysis starting ──');
  try {
    const { reportPath, fullReport, screenshots } = await runAnalysis('weekly');
    await sendReport(reportPath, fullReport, screenshots);
    log('── Weekly deep analysis complete ──');
  } catch (err) {
    log(`Weekly job failed: ${err.message}`);
    // Try to email the error
    try {
      await sendReport(null, `Revenue Intel weekly analysis FAILED:\n\n${err.message}`, []);
    } catch (notifyErr) {
      log(`Failed to send error notification: ${notifyErr.message}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

validateEnv();

log('Revenue Intelligence Scheduler starting...');
log(`Daily schedule: ${DAILY_CRON}`);
log(`Weekly schedule: ${WEEKLY_CRON}`);

// Schedule daily job
cron.schedule(DAILY_CRON, runDailyJob, {
  timezone: 'America/Vancouver',
});
log('Daily cron job registered.');

// Schedule weekly job
cron.schedule(WEEKLY_CRON, runWeeklyJob, {
  timezone: 'America/Vancouver',
});
log('Weekly cron job registered.');

// Handle --now flag for immediate execution
const args = process.argv.slice(2);
const modeIdx = args.indexOf('--mode');
const nowFlag = args.includes('--now');

if (nowFlag) {
  const mode = modeIdx !== -1 && args[modeIdx + 1] ? args[modeIdx + 1] : 'weekly';
  log(`--now flag detected. Running ${mode} analysis immediately...`);

  if (mode === 'daily') {
    runDailyJob().catch(err => log(`Immediate daily job error: ${err.message}`));
  } else {
    runWeeklyJob().catch(err => log(`Immediate weekly job error: ${err.message}`));
  }
}

log('Scheduler is running. Waiting for next scheduled job...');
