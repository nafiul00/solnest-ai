/**
 * PriceLabs Agent — Scheduled Runner
 *
 * Runs the PriceLabs analyzer on a weekly schedule and emails the report.
 * Default: Every Monday at 8:00 AM (configurable via CRON_SCHEDULE in .env)
 *
 * Usage:
 *   npm start          — Start the scheduler (runs in background)
 *   npm run analyze    — Run analysis once immediately
 *   npm run setup      — First-time setup (install browser + login)
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { runAnalysis } = require('./analyze');
const { sendReport } = require('./email');

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * 1'; // Monday 8 AM

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);

  // Also log to file — wrapped so a disk-full error doesn't crash the agent
  try {
    const logPath = path.join(__dirname, 'agent.log');
    fs.appendFileSync(logPath, line + '\n');
  } catch (e) {
    console.error(`[log] Could not write to agent.log: ${e.message}`);
  }
}

async function runJob() {
  log('Starting scheduled PriceLabs analysis...');

  try {
    const { reportPath, fullReport, reports } = await runAnalysis();

    // Collect screenshot paths
    const screenshots = reports
      .map(r => r.neighborhoodScreenshot)
      .filter(Boolean);

    // Send email
    log('Sending report via email...');
    await sendReport(reportPath, fullReport, screenshots);
    log('Report sent successfully!');
  } catch (error) {
    log(`ERROR: ${error.message}`);
    log(error.stack);

    // Try to send error notification
    try {
      await sendReport(
        path.join(__dirname, 'agent.log'),
        `PriceLabs analysis FAILED at ${new Date().toISOString()}\n\nError: ${error.message}\n\nCheck agent.log for details.`,
        []
      );
    } catch (emailErr) {
      log(`Failed to send error notification: ${emailErr.message}`);
    }
  }
}

// Validate cron expression
if (!cron.validate(CRON_SCHEDULE)) {
  log(`Invalid cron schedule: ${CRON_SCHEDULE}`);
  process.exit(1);
}

log(`PriceLabs Agent started`);
log(`Schedule: ${CRON_SCHEDULE}`);
log(`Next run: ${getNextRun(CRON_SCHEDULE)}`);
log('Press Ctrl+C to stop\n');

// Schedule the job
cron.schedule(CRON_SCHEDULE, runJob, {
  timezone: 'America/Vancouver' // BC timezone for Prince George / Sun Peaks
});

// Also run immediately if --now flag is passed
if (process.argv.includes('--now')) {
  log('Running immediately (--now flag detected)...');
  runJob().catch(err => {
    log(`Immediate run failed: ${err.message}`);
  });
}

function getNextRun(cronExpr) {
  // Simple next-run calculator for display purposes
  const parts = cronExpr.split(' ');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (parts[4] !== '*') {
    const dayNum = parseInt(parts[4]);
    const hour = parts[1];
    const minute = parts[0];
    return `${days[dayNum]} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  return 'See cron expression';
}

// Keep process alive
process.on('SIGINT', () => {
  log('Agent stopped by user');
  process.exit(0);
});
