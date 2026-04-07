/**
 * Daily Metrics Sync
 *
 * Reads the latest pricelabs report, extracts per-property metrics,
 * and upserts them to the Notion Property Performance database.
 *
 * Runs daily at 6 AM.
 */

import fs from 'fs';
import {
  findLatestReport,
  splitReportByProperty,
  parsePropertyMetrics,
} from './parsers.js';
import { queryDatabase, createPage, updatePage } from './notion.js';

/**
 * Sync daily metrics for a single client.
 */
export async function syncMetrics(clientConfig) {
  const reportsDir = clientConfig._resolved_sources.pricelabs_reports;
  const dbId = clientConfig.notion_databases.property_performance;
  // Use local date (not UTC) so metrics are filed under the correct local day
  const today = new Date().toLocaleDateString('en-CA'); // Returns YYYY-MM-DD in local timezone

  console.log(`[Metrics] Syncing ${clientConfig.client_id} — ${today}`);

  // Find latest report
  const reportPath = findLatestReport(reportsDir);
  if (!reportPath) {
    console.warn(`[Metrics] No reports found in ${reportsDir}`);
    return { synced: 0, skipped: 0, errors: 0 };
  }

  const reportMarkdown = fs.readFileSync(reportPath, 'utf-8');
  const propertySections = splitReportByProperty(reportMarkdown);

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const property of clientConfig.properties) {
    try {
      // Find matching section in report
      const section = propertySections.find(s =>
        s.propertyName.toLowerCase().includes(property.name.toLowerCase()) ||
        property.name.toLowerCase().includes(s.propertyName.toLowerCase())
      );

      if (!section) {
        console.warn(`[Metrics] No report section found for ${property.name}`);
        skipped++;
        continue;
      }

      const metrics = parsePropertyMetrics(section.rawSection);

      // Check if today's entry already exists (upsert)
      const existing = await queryDatabase(dbId, {
        filter: {
          and: [
            { property: 'Property', title: { equals: property.name } },
            { property: 'Date', date: { equals: today } },
          ],
        },
      });

      const properties = buildMetricsProperties(property.name, today, metrics);

      if (existing.results.length > 0) {
        // Update existing entry
        await updatePage(existing.results[0].id, properties);
        console.log(`[Metrics] Updated ${property.name}`);
      } else {
        // Create new entry
        await createPage(dbId, properties);
        console.log(`[Metrics] Created ${property.name}`);
      }

      synced++;
    } catch (err) {
      console.error(`[Metrics] Failed for ${property.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`[Metrics] Done: ${synced} synced, ${skipped} skipped, ${errors} errors`);
  return { synced, skipped, errors };
}

/**
 * Build Notion page properties from parsed metrics.
 */
function buildMetricsProperties(propertyName, date, metrics) {
  const props = {
    Property: { title: [{ text: { content: propertyName } }] },
    Date: { date: { start: date } },
    'Last Updated': { date: { start: new Date().toISOString() } },
  };

  // Only set numeric properties if we have values (Notion rejects null numbers)
  // Notion percent format expects decimals: 0.65 = 65%, not raw 65
  if (metrics.occupancy_30n != null) {
    props['Occupancy Rate'] = { number: metrics.occupancy_30n / 100 };
  }
  if (metrics.adr != null) {
    props['ADR'] = { number: metrics.adr };
  }
  if (metrics.revenue_mtd != null) {
    props['Revenue (MTD)'] = { number: metrics.revenue_mtd };
  }
  if (metrics.revpar != null) {
    props['RevPAR'] = { number: metrics.revpar };
  }
  if (metrics.avg_lead_time != null) {
    props['Avg Lead Time'] = { number: metrics.avg_lead_time };
  }
  if (metrics.comp_set_rank) {
    props['Comp Set Rank'] = { select: { name: metrics.comp_set_rank } };
  }
  if (metrics.risk_flags.length > 0) {
    props['Risk Flags'] = {
      multi_select: metrics.risk_flags.map(flag => ({ name: flag })),
    };
  }

  return props;
}
