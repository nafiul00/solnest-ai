/**
 * Cron Scheduler
 *
 * Schedules daily and weekly sync jobs per client.
 * Daily (6 AM): metrics + guest log
 * Weekly (Monday 7 AM): full reports
 */

import cron from 'node-cron';
import { getAllConfigs } from '../config/loader.js';
import { syncMetrics } from './sync-metrics.js';
import { syncReports } from './sync-reports.js';
import { syncGuestLog } from './sync-guests.js';

const activeJobs = [];

/**
 * Start all scheduled jobs for all clients.
 */
export function startScheduler() {
  const configs = getAllConfigs();

  if (configs.length === 0) {
    console.warn('[Scheduler] No client configs loaded — nothing to schedule');
    return;
  }

  for (const config of configs) {
    const dailyCron = config.schedule?.daily_metrics || '0 6 * * *';
    const weeklyCron = config.schedule?.weekly_report || '0 7 * * 1';

    // Daily: metrics + guest log
    const dailyJob = cron.schedule(dailyCron, async () => {
      console.log(`[Scheduler] Running daily sync for ${config.client_id}`);
      try {
        await syncMetrics(config);
      } catch (err) {
        console.error(`[Scheduler] Metrics sync failed for ${config.client_id}: ${err.message}`);
      }
      try {
        await syncGuestLog(config);
      } catch (err) {
        console.error(`[Scheduler] Guest log sync failed for ${config.client_id}: ${err.message}`);
      }
    });

    // Weekly: full reports
    const weeklyJob = cron.schedule(weeklyCron, async () => {
      console.log(`[Scheduler] Running weekly sync for ${config.client_id}`);
      try {
        await syncReports(config);
      } catch (err) {
        console.error(`[Scheduler] Report sync failed for ${config.client_id}: ${err.message}`);
      }
    });

    activeJobs.push(dailyJob, weeklyJob);

    console.log(`[Scheduler] ${config.client_id}: daily="${dailyCron}" weekly="${weeklyCron}"`);
  }

  console.log(`[Scheduler] ${activeJobs.length} jobs scheduled for ${configs.length} client(s)`);
}

/**
 * Stop all scheduled jobs.
 */
export function stopScheduler() {
  for (const job of activeJobs) {
    job.stop();
  }
  activeJobs.length = 0;
  console.log('[Scheduler] All jobs stopped');
}

/**
 * Run all syncs immediately for a client (manual trigger).
 */
export async function runNow(clientConfig, { weekly = false } = {}) {
  console.log(`[RunNow] ${clientConfig.client_id} — daily${weekly ? ' + weekly' : ''}`);

  const results = { metrics: null, guestLog: null, reports: null };

  try {
    results.metrics = await syncMetrics(clientConfig);
  } catch (err) {
    console.error(`[RunNow] Metrics failed: ${err.message}`);
    results.metrics = { error: err.message };
  }

  try {
    results.guestLog = await syncGuestLog(clientConfig);
  } catch (err) {
    console.error(`[RunNow] Guest log failed: ${err.message}`);
    results.guestLog = { error: err.message };
  }

  if (weekly) {
    try {
      results.reports = await syncReports(clientConfig);
    } catch (err) {
      console.error(`[RunNow] Reports failed: ${err.message}`);
      results.reports = { error: err.message };
    }
  }

  return results;
}
