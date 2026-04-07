/**
 * Weekly Report Sync
 *
 * Reads the latest pricelabs report, creates a new page in the
 * Notion Weekly Reports database with the full report as page content.
 *
 * Runs weekly on Monday at 7 AM.
 */

import fs from 'fs';
import {
  findLatestReport,
  splitReportByProperty,
  markdownToNotionBlocks,
  generateSummary,
} from './parsers.js';
import { queryDatabase, createPage, appendBlocks, updatePage } from './notion.js';

/**
 * Sync weekly reports for a single client.
 */
export async function syncReports(clientConfig) {
  const reportsDir = clientConfig._resolved_sources.pricelabs_reports;
  const dbId = clientConfig.notion_databases.weekly_reports;

  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  console.log(`[Reports] Syncing ${clientConfig.client_id} — Week of ${weekLabel}`);

  // Find latest report
  const reportPath = findLatestReport(reportsDir);
  if (!reportPath) {
    console.warn(`[Reports] No reports found in ${reportsDir}`);
    return { synced: 0, errors: 0 };
  }

  const reportMarkdown = fs.readFileSync(reportPath, 'utf-8');
  const propertySections = splitReportByProperty(reportMarkdown);

  let synced = 0;
  let errors = 0;

  // Archive previous "Current" reports
  try {
    const currentReports = await queryDatabase(dbId, {
      filter: { property: 'Status', select: { equals: 'Current' } },
    });
    for (const page of currentReports.results) {
      await updatePage(page.id, { Status: { select: { name: 'Archived' } } });
    }
  } catch (err) {
    console.warn(`[Reports] Failed to archive old reports: ${err.message}`);
  }

  for (const property of clientConfig.properties) {
    try {
      // Find matching section
      const section = propertySections.find(s =>
        s.propertyName.toLowerCase().includes(property.name.toLowerCase()) ||
        property.name.toLowerCase().includes(s.propertyName.toLowerCase())
      );

      if (!section) {
        console.warn(`[Reports] No report section for ${property.name}`);
        continue;
      }

      const title = `${property.name} — Week of ${weekLabel}`;
      const summary = generateSummary(section.rawSection);

      // Check for duplicate (same property + same week)
      const existing = await queryDatabase(dbId, {
        filter: {
          and: [
            { property: 'Property', select: { equals: property.name } },
            { property: 'Week', date: { equals: weekStart.toISOString().split('T')[0] } },
          ],
        },
      });

      if (existing.results.length > 0) {
        console.log(`[Reports] Already exists: ${title} — skipping`);
        synced++;
        continue;
      }

      // Create page with properties
      const pageProperties = {
        Title: { title: [{ text: { content: title } }] },
        Property: { select: { name: property.name } },
        Week: { date: { start: weekStart.toISOString().split('T')[0] } },
        Status: { select: { name: 'Current' } },
        Summary: {
          rich_text: [{ text: { content: summary.slice(0, 2000) } }],
        },
      };

      const page = await createPage(dbId, pageProperties);

      // Convert report markdown to Notion blocks and append to page
      const blocks = markdownToNotionBlocks(section.rawSection);
      if (blocks.length > 0) {
        await appendBlocks(page.id, blocks);
      }

      console.log(`[Reports] Created: ${title}`);
      synced++;
    } catch (err) {
      console.error(`[Reports] Failed for ${property.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`[Reports] Done: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

/**
 * Get the Monday of the current week.
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
