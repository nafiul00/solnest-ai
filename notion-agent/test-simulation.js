/**
 * Notion Agent — Test Simulation
 *
 * Tests all parsers, config loading, and data transformations
 * WITHOUT requiring a Notion API connection.
 *
 * Usage: node test-simulation.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateConfig } from './config/schema.js';
import { loadAllConfigs, getConfig, getAllConfigs } from './config/loader.js';
import {
  findLatestReport,
  splitReportByProperty,
  parsePropertyMetrics,
  generateSummary,
  readConversations,
  aggregateConversation,
  markdownToNotionBlocks,
} from './lib/parsers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Sample Data ─────────────────────────────────────────

const SAMPLE_REPORT = `# Solnest Stays — Weekly Pricing Report
**Generated:** 3/23/2026, 10:00:00 AM

---

# Boho Bliss — Weekly Pricing Report

**Date:** 3/23/2026
**Current Setup:** Base price $125, Min $95, Max $200
**Occupancy:** 71% / 65% / 58%

## Market Position
Boho Bliss is currently priced slightly above market median. The ADR of $132 puts it in a competitive position for the neighborhood. The listing has an ADR: $132 which is competitive.

## Calendar Analysis
Several dates in April show pricing significantly below market ADR (>15% gap). April 14-16 are flagged at $95 (min floor) while market ADR sits at $140.

## Customization Review
| Rule | Current | Assessment | Recommendation |
| --- | --- | --- | --- |
| Min Stay | 2 nights | Appropriate | Keep |
| Last Min Discount | -15% | Too aggressive | Reduce to -10% |
| Far Out Premium | +10% | Good | Keep |

## Top Recommendations (ranked by revenue impact)
1. Raise base price from $125 to $135 — currently below optimal based on demand factor
2. Reduce last-minute discount from 15% to 10% — losing $12/night unnecessarily
3. Add orphan day fill pricing — 3 single-night gaps detected this month
4. Consider raising min floor from $95 to $105

For each: what to change, from → to, and why.

## Risk Flags
Low occupancy trend detected in 60-day window. Min floor hit on 5 dates this month. Orphan days creating revenue gaps.

---

# The Urban Nest — Weekly Pricing Report

**Date:** 3/23/2026
**Current Setup:** Base price $150, Min $110, Max $250
**Occupancy:** 85% / 78% / 72%

## Market Position
The Urban Nest is priced above the market median. Strong demand with RevPAR of $117. Lead time averaging 12 days.

## Calendar Analysis
No concerning gaps. Calendar looks healthy for the next 30 days.

## Customization Review
| Rule | Current | Assessment | Recommendation |
| --- | --- | --- | --- |
| Min Stay | 3 nights | Consider reducing to 2 | Reduce for weekdays |
| Weekend Premium | +20% | Good | Keep |

## Top Recommendations (ranked by revenue impact)
1. Reduce min stay to 2 nights on weekdays — filling 2-night gaps could add $300/month revenue
2. Raise weekend premium to 25% — demand supports it

## Risk Flags
No significant risks. Performance is strong.

---
`;

const SAMPLE_CONVERSATION = {
  thread_id: 'conv-12345',
  client_id: 'solnest',
  messages: [
    { role: 'guest', content: 'What is the WiFi password?', timestamp: '2026-03-22T10:00:00.000Z' },
    { role: 'assistant', content: 'The WiFi password is sunbeam2024!', timestamp: '2026-03-22T10:00:02.500Z', sent: true },
    { role: 'guest', content: 'Where do I park?', timestamp: '2026-03-22T14:30:00.000Z' },
    { role: 'assistant', content: 'You can park in the driveway. Space for 2 vehicles.', timestamp: '2026-03-22T14:30:03.000Z', sent: true },
    { role: 'guest', content: 'There is a water leak!', timestamp: '2026-03-22T20:00:00.000Z' },
    { role: 'system', content: 'Escalated: emergency — Guest reported water leak', timestamp: '2026-03-22T20:00:01.000Z' },
  ],
  created_at: '2026-03-22T10:00:00.000Z',
  updated_at: '2026-03-22T20:00:01.000Z',
};

// ══════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════

console.log('\n═══ CONFIG VALIDATION ═══');

// Valid UUID used in multiple tests
const VALID_UUID_1 = '12345678-1234-1234-1234-123456789abc';
const VALID_UUID_2 = 'abcdef01-2345-6789-abcd-ef0123456789';
const VALID_UUID_3 = '00000000-0000-0000-0000-000000000001';

test('validates correct config with valid UUIDs', () => {
  const config = {
    client_id: 'test',
    client_name: 'Test',
    notion_databases: {
      property_performance: VALID_UUID_1,
      weekly_reports: VALID_UUID_2,
      guest_log: VALID_UUID_3,
    },
    data_sources: {
      pricelabs_reports: './reports',
      guest_conversations: './conversations',
    },
    properties: [{ slug: 'test-prop', name: 'Test Property' }],
  };
  assert(validateConfig(config) === true);
});

test('rejects placeholder database IDs (REPLACE_AFTER_SETUP)', () => {
  let threw = false;
  try {
    validateConfig({
      client_id: 'test', client_name: 'Test',
      notion_databases: {
        property_performance: 'REPLACE_AFTER_SETUP',
        weekly_reports: 'REPLACE_AFTER_SETUP',
        guest_log: 'REPLACE_AFTER_SETUP',
      },
      data_sources: { pricelabs_reports: 'x', guest_conversations: 'x' },
      properties: [{ slug: 'test', name: 'Test' }],
    });
  } catch {
    threw = true;
  }
  assert(threw, 'Should reject non-UUID database IDs');
});

test('rejects non-UUID database IDs', () => {
  let threw = false;
  try {
    validateConfig({
      client_id: 'test', client_name: 'Test',
      notion_databases: {
        property_performance: 'not-a-uuid',
        weekly_reports: VALID_UUID_2,
        guest_log: VALID_UUID_3,
      },
      data_sources: { pricelabs_reports: 'x', guest_conversations: 'x' },
      properties: [{ slug: 'test', name: 'Test' }],
    });
  } catch {
    threw = true;
  }
  assert(threw, 'Should reject invalid UUID format');
});

test('accepts UUIDs without dashes', () => {
  const config = {
    client_id: 'test', client_name: 'Test',
    notion_databases: {
      property_performance: '12345678123412341234123456789abc',
      weekly_reports: VALID_UUID_2,
      guest_log: VALID_UUID_3,
    },
    data_sources: { pricelabs_reports: 'x', guest_conversations: 'x' },
    properties: [{ slug: 'test', name: 'Test' }],
  };
  assert(validateConfig(config) === true);
});

test('rejects missing client_id', () => {
  let threw = false;
  try {
    validateConfig({ client_name: 'Test', notion_databases: {}, data_sources: {}, properties: [] });
  } catch {
    threw = true;
  }
  assert(threw, 'Should throw on missing client_id');
});

test('rejects missing notion_databases', () => {
  let threw = false;
  try {
    validateConfig({
      client_id: 'test', client_name: 'Test',
      notion_databases: { property_performance: VALID_UUID_1 },
      data_sources: { pricelabs_reports: 'x', guest_conversations: 'x' },
      properties: [],
    });
  } catch {
    threw = true;
  }
  assert(threw, 'Should throw on missing database IDs');
});

test('rejects property without slug', () => {
  let threw = false;
  try {
    validateConfig({
      client_id: 'test', client_name: 'Test',
      notion_databases: { property_performance: VALID_UUID_1, weekly_reports: VALID_UUID_2, guest_log: VALID_UUID_3 },
      data_sources: { pricelabs_reports: 'x', guest_conversations: 'x' },
      properties: [{ name: 'Test' }],
    });
  } catch {
    threw = true;
  }
  assert(threw, 'Should throw on property without slug');
});

test('rejects properties as non-array', () => {
  let threw = false;
  try {
    validateConfig({
      client_id: 'test', client_name: 'Test',
      notion_databases: { property_performance: VALID_UUID_1, weekly_reports: VALID_UUID_2, guest_log: VALID_UUID_3 },
      data_sources: { pricelabs_reports: 'x', guest_conversations: 'x' },
      properties: 'not an array',
    });
  } catch {
    threw = true;
  }
  assert(threw, 'Should throw on non-array properties');
});

console.log('\n═══ CONFIG LOADER ═══');

test('loadAllConfigs runs without crashing', () => {
  // solnest.json has placeholder database IDs, so it will fail validation
  // but the loader should not crash — it logs warnings and continues
  loadAllConfigs();
  const configs = getAllConfigs();
  assert(Array.isArray(configs), 'getAllConfigs should return array');
  // If solnest.json has placeholder IDs, no configs will load (validation rejects them)
  // This is correct behavior — the client needs to set up real Notion database IDs
});

test('rejects solnest config with placeholder database IDs', () => {
  loadAllConfigs();
  const config = getConfig('solnest');
  // solnest.json has "REPLACE_AFTER_SETUP" for database IDs — should not load
  assert(config === null, 'Config with placeholder IDs should be rejected by UUID validation');
});

test('getConfig returns null for unknown client', () => {
  const config = getConfig('nonexistent');
  assert(config === null);
});

console.log('\n═══ REPORT PARSER ═══');

test('splits report by property', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  assertEqual(sections.length, 2);
  assertEqual(sections[0].propertyName, 'Boho Bliss');
  assertEqual(sections[1].propertyName, 'The Urban Nest');
});

test('extracts date from property section', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  assertEqual(sections[0].date, '3/23/2026');
});

test('parses occupancy metrics', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const metrics = parsePropertyMetrics(sections[0].rawSection);
  assertEqual(metrics.occupancy_7n, 71);
  assertEqual(metrics.occupancy_30n, 65);
  assertEqual(metrics.occupancy_60n, 58);
});

test('parses ADR', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const metrics = parsePropertyMetrics(sections[0].rawSection);
  assertEqual(metrics.adr, 132);
});

test('parses RevPAR', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const metrics = parsePropertyMetrics(sections[1].rawSection);
  assertEqual(metrics.revpar, 117);
});

test('detects comp set rank: Above Market', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const metrics = parsePropertyMetrics(sections[0].rawSection);
  assertEqual(metrics.comp_set_rank, 'Above Market');
});

test('detects comp set rank: Above Market for Urban Nest', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const metrics = parsePropertyMetrics(sections[1].rawSection);
  assertEqual(metrics.comp_set_rank, 'Above Market');
});

test('parses risk flags', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const metrics = parsePropertyMetrics(sections[0].rawSection);
  assert(metrics.risk_flags.length > 0, 'Should have risk flags');
  assert(metrics.risk_flags.includes('Low Occupancy'), 'Should detect Low Occupancy');
  assert(metrics.risk_flags.includes('Min Floor Hit'), 'Should detect Min Floor Hit');
  assert(metrics.risk_flags.includes('Orphan Days'), 'Should detect Orphan Days');
});

test('no risk flags when report says no risks', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const metrics = parsePropertyMetrics(sections[1].rawSection);
  // Urban Nest says "No significant risks. Performance is strong."
  // Parser now detects "no risk" phrasing and skips adding any flags
  assertEqual(metrics.risk_flags.length, 0, `Expected 0 risk flags, got: ${JSON.stringify(metrics.risk_flags)}`);
});

test('generates summary', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const summary = generateSummary(sections[0].rawSection);
  assert(summary.length > 0, 'Summary should not be empty');
  assert(summary.includes('Occupancy'), 'Summary should mention occupancy');
});

test('handles empty report gracefully', () => {
  const sections = splitReportByProperty('');
  assertEqual(sections.length, 0);
});

test('handles report with only header', () => {
  const sections = splitReportByProperty('# Solnest Stays — Weekly Pricing Report\n');
  assertEqual(sections.length, 0);
});

test('parses lead time', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const metrics = parsePropertyMetrics(sections[1].rawSection);
  assertEqual(metrics.avg_lead_time, 12);
});

console.log('\n═══ CONVERSATION PARSER ═══');

test('aggregates conversation stats', () => {
  const stats = aggregateConversation(SAMPLE_CONVERSATION);
  assertEqual(stats.thread_id, 'conv-12345');
  assertEqual(stats.total_messages, 6);
  assertEqual(stats.guest_messages, 3);
  assertEqual(stats.assistant_messages, 2);
  assertEqual(stats.sent_messages, 2);
  assert(stats.escalated === true, 'Should be escalated');
  assertEqual(stats.status, 'Escalated');
});

test('calculates AI response rate', () => {
  const stats = aggregateConversation(SAMPLE_CONVERSATION);
  // 2 sent / 3 guest messages = 67%
  assertEqual(stats.ai_response_rate, 67);
});

test('extracts intent from escalation', () => {
  const stats = aggregateConversation(SAMPLE_CONVERSATION);
  assert(stats.intents.includes('emergency'));
  assertEqual(stats.latest_intent, 'emergency');
});

test('handles empty conversation', () => {
  const stats = aggregateConversation({ thread_id: 'empty', client_id: 'test', messages: [] });
  assertEqual(stats.total_messages, 0);
  assertEqual(stats.ai_response_rate, 0);
  assert(!stats.escalated);
  assertEqual(stats.status, 'Active');
});

test('detects resolved status', () => {
  const conv = {
    thread_id: 'resolved',
    client_id: 'test',
    messages: [
      { role: 'guest', content: 'Hi', timestamp: '2026-03-22T10:00:00Z' },
      { role: 'assistant', content: 'Hello!', timestamp: '2026-03-22T10:00:02Z', sent: true },
    ],
  };
  const stats = aggregateConversation(conv);
  assertEqual(stats.status, 'Resolved');
});

test('handles conversation with only guest messages', () => {
  const conv = {
    thread_id: 'guest-only',
    client_id: 'test',
    messages: [
      { role: 'guest', content: 'Hello?', timestamp: '2026-03-22T10:00:00Z' },
    ],
  };
  const stats = aggregateConversation(conv);
  assertEqual(stats.status, 'Active');
  assertEqual(stats.ai_response_rate, 0);
});

test('handles draft (not sent) messages', () => {
  const conv = {
    thread_id: 'draft-test',
    client_id: 'test',
    messages: [
      { role: 'guest', content: 'Hi', timestamp: '2026-03-22T10:00:00Z' },
      { role: 'assistant', content: 'Hello!', timestamp: '2026-03-22T10:00:02Z', sent: false, status: 'draft' },
    ],
  };
  const stats = aggregateConversation(conv);
  assertEqual(stats.sent_messages, 0);
  assertEqual(stats.ai_response_rate, 0);
});

test('readConversations returns empty for nonexistent dir', () => {
  const convs = readConversations('/nonexistent/path');
  assertEqual(convs.length, 0);
});

console.log('\n═══ MARKDOWN → NOTION BLOCKS ═══');

test('converts heading 1', () => {
  const blocks = markdownToNotionBlocks('# Main Title');
  assertEqual(blocks.length, 1);
  assertEqual(blocks[0].type, 'heading_1');
  assertEqual(blocks[0].heading_1.rich_text[0].text.content, 'Main Title');
});

test('converts heading 2', () => {
  const blocks = markdownToNotionBlocks('## Section');
  assertEqual(blocks[0].type, 'heading_2');
});

test('converts heading 3', () => {
  const blocks = markdownToNotionBlocks('### Subsection');
  assertEqual(blocks[0].type, 'heading_3');
});

test('converts bullet list', () => {
  const blocks = markdownToNotionBlocks('- Item 1\n- Item 2');
  assertEqual(blocks.length, 2);
  assertEqual(blocks[0].type, 'bulleted_list_item');
  assertEqual(blocks[1].type, 'bulleted_list_item');
});

test('converts numbered list', () => {
  const blocks = markdownToNotionBlocks('1. First\n2. Second');
  assertEqual(blocks.length, 2);
  assertEqual(blocks[0].type, 'numbered_list_item');
});

test('converts divider', () => {
  const blocks = markdownToNotionBlocks('---');
  assertEqual(blocks.length, 1);
  assertEqual(blocks[0].type, 'divider');
});

test('converts callout (blockquote)', () => {
  const blocks = markdownToNotionBlocks('> Important note');
  assertEqual(blocks[0].type, 'callout');
  assertEqual(blocks[0].callout.rich_text[0].text.content, 'Important note');
});

test('converts paragraph', () => {
  const blocks = markdownToNotionBlocks('Just plain text here.');
  assertEqual(blocks[0].type, 'paragraph');
});

test('converts table', () => {
  const md = '| Col1 | Col2 |\n| --- | --- |\n| A | B |\n| C | D |';
  const blocks = markdownToNotionBlocks(md);
  assertEqual(blocks.length, 1);
  assertEqual(blocks[0].type, 'table');
  assertEqual(blocks[0].table.table_width, 2);
  assertEqual(blocks[0].table.has_column_header, true);
  // 3 data rows (header + 2 data, separator filtered out)
  assertEqual(blocks[0].table.children.length, 3);
});

test('skips empty lines', () => {
  const blocks = markdownToNotionBlocks('Line 1\n\n\nLine 2');
  assertEqual(blocks.length, 2);
});

test('parses bold formatting', () => {
  const blocks = markdownToNotionBlocks('This is **bold** text');
  const richText = blocks[0].paragraph.rich_text;
  assert(richText.length > 1, 'Should have multiple rich_text parts');
  const boldPart = richText.find(r => r.annotations?.bold);
  assert(boldPart, 'Should have a bold annotation');
  assertEqual(boldPart.text.content, 'bold');
});

test('parses italic formatting', () => {
  const blocks = markdownToNotionBlocks('This is *italic* text');
  const richText = blocks[0].paragraph.rich_text;
  const italicPart = richText.find(r => r.annotations?.italic);
  assert(italicPart, 'Should have an italic annotation');
  assertEqual(italicPart.text.content, 'italic');
});

test('parses code formatting', () => {
  const blocks = markdownToNotionBlocks('Use `npm start` to begin');
  const richText = blocks[0].paragraph.rich_text;
  const codePart = richText.find(r => r.annotations?.code);
  assert(codePart, 'Should have a code annotation');
  assertEqual(codePart.text.content, 'npm start');
});

test('handles complex markdown document', () => {
  const blocks = markdownToNotionBlocks(SAMPLE_REPORT);
  assert(blocks.length > 10, `Expected many blocks, got ${blocks.length}`);

  // Check for variety of block types
  const types = new Set(blocks.map(b => b.type));
  assert(types.has('heading_1') || types.has('heading_2'), 'Should have headings');
  assert(types.has('paragraph'), 'Should have paragraphs');
  assert(types.has('divider'), 'Should have dividers');
  assert(types.has('table'), 'Should have tables');
  assert(types.has('numbered_list_item'), 'Should have numbered lists');
});

test('handles empty markdown', () => {
  const blocks = markdownToNotionBlocks('');
  assertEqual(blocks.length, 0);
});

test('handles asterisk bullet lists', () => {
  const blocks = markdownToNotionBlocks('* Asterisk item');
  assertEqual(blocks[0].type, 'bulleted_list_item');
});

test('splits long text into 2000-char chunks for Notion API', () => {
  const longText = 'A'.repeat(4500);
  const blocks = markdownToNotionBlocks(longText);
  // Should be a paragraph with multiple rich_text parts
  const richText = blocks[0].paragraph.rich_text;
  assert(richText.length >= 3, `Expected >=3 chunks, got ${richText.length}`);
  assertEqual(richText[0].text.content.length, 2000);
  assertEqual(richText[1].text.content.length, 2000);
  assertEqual(richText[2].text.content.length, 500);
});

test('normalizes table rows to consistent column count', () => {
  // Row with extra column
  const md = '| A | B |\n| --- | --- |\n| C | D | E |';
  const blocks = markdownToNotionBlocks(md);
  const table = blocks[0];
  assertEqual(table.table.table_width, 2);
  // All rows should have exactly 2 cells
  for (const row of table.table.children) {
    assertEqual(row.table_row.cells.length, 2);
  }
});

test('pads short table rows with empty cells', () => {
  const md = '| A | B | C |\n| --- | --- | --- |\n| D |';
  const blocks = markdownToNotionBlocks(md);
  const table = blocks[0];
  assertEqual(table.table.table_width, 3);
  // Last row should be padded to 3 cells
  const lastRow = table.table.children[table.table.children.length - 1];
  assertEqual(lastRow.table_row.cells.length, 3);
});

console.log('\n═══ FINDLATESTREPORT ═══');

test('findLatestReport returns null for nonexistent dir', () => {
  const result = findLatestReport('/nonexistent/dir');
  assert(result === null);
});

test('findLatestReport handles empty directory', () => {
  const tmpDir = path.join(__dirname, '_test_empty_reports');
  fs.mkdirSync(tmpDir, { recursive: true });
  const result = findLatestReport(tmpDir);
  assert(result === null);
  fs.rmdirSync(tmpDir);
});

test('findLatestReport picks most recent file', () => {
  const tmpDir = path.join(__dirname, '_test_reports');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'report-2026-03-01.md'), 'old');
  fs.writeFileSync(path.join(tmpDir, 'report-2026-03-15.md'), 'newer');
  fs.writeFileSync(path.join(tmpDir, 'report-2026-03-22.md'), 'newest');
  fs.writeFileSync(path.join(tmpDir, 'not-a-report.txt'), 'ignore');

  // Explicitly set distinct mtimes so sort order is deterministic
  // (files written in same second get same mtime on some filesystems)
  const now = Date.now();
  fs.utimesSync(path.join(tmpDir, 'report-2026-03-01.md'), new Date(now - 3000), new Date(now - 3000));
  fs.utimesSync(path.join(tmpDir, 'report-2026-03-15.md'), new Date(now - 2000), new Date(now - 2000));
  fs.utimesSync(path.join(tmpDir, 'report-2026-03-22.md'), new Date(now - 1000), new Date(now - 1000));

  const result = findLatestReport(tmpDir);
  assert(result.endsWith('report-2026-03-22.md'), `Got: ${result}`);

  // Cleanup
  fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
  fs.rmdirSync(tmpDir);
});

console.log('\n═══ INTEGRATION: REPORT → NOTION PROPERTIES ═══');

test('full pipeline: report → metrics → properties shape', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const metrics = parsePropertyMetrics(sections[0].rawSection);

  // Simulate what sync-metrics does
  const today = '2026-03-23';
  const props = {
    Property: { title: [{ text: { content: 'Boho Bliss' } }] },
    Date: { date: { start: today } },
    'Last Updated': { date: { start: new Date().toISOString() } },
  };
  // Notion percent format expects decimals (0.65 = 65%)
  if (metrics.occupancy_30n != null) props['Occupancy Rate'] = { number: metrics.occupancy_30n / 100 };
  if (metrics.adr != null) props['ADR'] = { number: metrics.adr };
  if (metrics.comp_set_rank) props['Comp Set Rank'] = { select: { name: metrics.comp_set_rank } };
  if (metrics.risk_flags.length > 0) {
    props['Risk Flags'] = { multi_select: metrics.risk_flags.map(f => ({ name: f })) };
  }

  // Verify the shape matches Notion API expectations
  assert(props.Property.title[0].text.content === 'Boho Bliss');
  assert(props.Date.date.start === '2026-03-23');
  assertEqual(props['Occupancy Rate'].number, 0.65);
  assertEqual(props.ADR.number, 132);
  assertEqual(props['Comp Set Rank'].select.name, 'Above Market');
  assert(props['Risk Flags'].multi_select.length >= 3);
});

test('full pipeline: conversation → guest log properties shape', () => {
  const stats = aggregateConversation(SAMPLE_CONVERSATION);

  const props = {
    'Thread ID': { title: [{ text: { content: stats.thread_id } }] },
    'Total Messages': { number: stats.total_messages },
    Escalated: { checkbox: stats.escalated },
    Status: { select: { name: stats.status } },
    'AI Response Rate': { number: stats.ai_response_rate / 100 },
  };
  if (stats.latest_intent) props.Intent = { select: { name: stats.latest_intent } };

  assertEqual(props['Thread ID'].title[0].text.content, 'conv-12345');
  assertEqual(props['Total Messages'].number, 6);
  assert(props.Escalated.checkbox === true);
  assertEqual(props.Status.select.name, 'Escalated');
  assertEqual(props.Intent.select.name, 'emergency');
  assertEqual(props['AI Response Rate'].number, 0.67);
});

test('full pipeline: report section → Notion blocks', () => {
  const sections = splitReportByProperty(SAMPLE_REPORT);
  const blocks = markdownToNotionBlocks(sections[0].rawSection);

  // Should produce a meaningful set of blocks
  assert(blocks.length > 5, `Expected >5 blocks, got ${blocks.length}`);

  // Should have table from Customization Review
  const tables = blocks.filter(b => b.type === 'table');
  assert(tables.length >= 1, 'Should have at least one table');

  // Table should have correct structure
  const table = tables[0];
  assert(table.table.table_width >= 2, 'Table should have at least 2 columns');
  assert(table.table.children.length >= 2, 'Table should have header + data rows');
});

// ── SYNC-METRICS: buildMetricsProperties ─────────────────

console.log('\n═══ SYNC-METRICS: buildMetricsProperties ═══');

// Inline the pure function from sync-metrics.js
function buildMetricsProperties(propertyName, date, metrics) {
  const props = {
    Property: { title: [{ text: { content: propertyName } }] },
    Date: { date: { start: date } },
    'Last Updated': { date: { start: new Date().toISOString() } },
  };
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

test('buildMetricsProperties with full metrics', () => {
  const metrics = {
    occupancy_30n: 65,
    adr: 185,
    revenue_mtd: 5200,
    revpar: 120,
    avg_lead_time: 14,
    comp_set_rank: 'Above Market',
    risk_flags: ['Low Occupancy', 'Rate Gap'],
  };
  const props = buildMetricsProperties('Boho Bliss', '2026-03-24', metrics);
  assertEqual(props.Property.title[0].text.content, 'Boho Bliss');
  assertEqual(props.Date.date.start, '2026-03-24');
  assertEqual(props['Occupancy Rate'].number, 0.65);
  assertEqual(props.ADR.number, 185);
  assertEqual(props['Revenue (MTD)'].number, 5200);
  assertEqual(props.RevPAR.number, 120);
  assertEqual(props['Avg Lead Time'].number, 14);
  assertEqual(props['Comp Set Rank'].select.name, 'Above Market');
  assertEqual(props['Risk Flags'].multi_select.length, 2);
});

test('buildMetricsProperties with minimal metrics (null values)', () => {
  const metrics = {
    occupancy_30n: null,
    adr: null,
    revenue_mtd: null,
    revpar: null,
    avg_lead_time: null,
    comp_set_rank: null,
    risk_flags: [],
  };
  const props = buildMetricsProperties('Test', '2026-03-24', metrics);
  assertEqual(props.Property.title[0].text.content, 'Test');
  assert(!('Occupancy Rate' in props), 'No Occupancy Rate when null');
  assert(!('ADR' in props), 'No ADR when null');
  assert(!('Revenue (MTD)' in props), 'No Revenue when null');
  assert(!('Risk Flags' in props), 'No Risk Flags when empty');
});

test('buildMetricsProperties occupancy boundary: 0 and 100', () => {
  const m0 = { occupancy_30n: 0, adr: null, revenue_mtd: null, revpar: null, avg_lead_time: null, comp_set_rank: null, risk_flags: [] };
  const p0 = buildMetricsProperties('Test', '2026-01-01', m0);
  assertEqual(p0['Occupancy Rate'].number, 0);

  const m100 = { occupancy_30n: 100, adr: null, revenue_mtd: null, revpar: null, avg_lead_time: null, comp_set_rank: null, risk_flags: [] };
  const p100 = buildMetricsProperties('Test', '2026-01-01', m100);
  assertEqual(p100['Occupancy Rate'].number, 1);
});

// ── SYNC-REPORTS: getWeekStart ───────────────────────────

console.log('\n═══ SYNC-REPORTS: getWeekStart ═══');

// Inline pure function from sync-reports.js
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// NOTE: Use new Date(year, month-1, day) for local-time dates.
// new Date('2026-03-23') creates UTC midnight which shifts back in US timezones.

test('getWeekStart: Monday input → same Monday', () => {
  const mon = new Date(2026, 2, 23); // March 23, 2026 = Monday (local time)
  const result = getWeekStart(mon);
  assertEqual(result.getDay(), 1, 'Result is Monday');
  assertEqual(result.getDate(), 23, 'Date is 23');
  assertEqual(result.getMonth(), 2, 'Month is March');
});

test('getWeekStart: Wednesday → previous Monday', () => {
  const wed = new Date(2026, 2, 25); // March 25 = Wednesday
  const result = getWeekStart(wed);
  assertEqual(result.getDay(), 1, 'Result is Monday');
  assertEqual(result.getDate(), 23, 'Rolled back to 23rd');
});

test('getWeekStart: Sunday → previous Monday', () => {
  const sun = new Date(2026, 2, 29); // March 29 = Sunday
  const result = getWeekStart(sun);
  assertEqual(result.getDay(), 1, 'Result is Monday');
  assertEqual(result.getDate(), 23, 'Sunday → previous Monday (23rd)');
});

test('getWeekStart: Saturday → same-week Monday', () => {
  const sat = new Date(2026, 2, 28); // March 28 = Saturday
  const result = getWeekStart(sat);
  assertEqual(result.getDay(), 1, 'Result is Monday');
  assertEqual(result.getDate(), 23, 'Saturday → same-week Monday');
});

test('getWeekStart: year boundary (Jan 1 2026 = Thursday)', () => {
  const jan1 = new Date(2026, 0, 1); // Jan 1, 2026 = Thursday
  const result = getWeekStart(jan1);
  assertEqual(result.getDay(), 1, 'Result is Monday');
  assertEqual(result.getMonth(), 11, 'Rolls back to December');
  assertEqual(result.getFullYear(), 2025, 'Rolls back to 2025');
  assertEqual(result.getDate(), 29, 'Dec 29 is the Monday');
});

// ── SYNC-GUESTS: buildGuestLogProperties ─────────────────

console.log('\n═══ SYNC-GUESTS: buildGuestLogProperties ═══');

// Inline pure function from sync-guests.js
function buildGuestLogProperties(stats, propertyName) {
  const props = {
    'Thread ID': { title: [{ text: { content: stats.thread_id } }] },
    'Total Messages': { number: stats.total_messages },
    'Escalated': { checkbox: stats.escalated },
    'Status': { select: { name: stats.status } },
    'AI Response Rate': { number: stats.ai_response_rate / 100 },
  };
  if (propertyName && propertyName !== 'Unknown') {
    props['Property'] = { select: { name: propertyName } };
  }
  if (stats.latest_intent) {
    props['Intent'] = { select: { name: stats.latest_intent } };
  }
  if (stats.last_message) {
    props['Last Message'] = { date: { start: stats.last_message } };
  }
  return props;
}

test('buildGuestLogProperties: full stats', () => {
  const stats = {
    thread_id: 'conv-999',
    total_messages: 10,
    escalated: true,
    status: 'Escalated',
    ai_response_rate: 80,
    latest_intent: 'complaint',
    last_message: '2026-03-24T12:00:00Z',
  };
  const props = buildGuestLogProperties(stats, 'Boho Bliss');
  assertEqual(props['Thread ID'].title[0].text.content, 'conv-999');
  assertEqual(props['Total Messages'].number, 10);
  assert(props['Escalated'].checkbox === true);
  assertEqual(props['AI Response Rate'].number, 0.80);
  assertEqual(props['Property'].select.name, 'Boho Bliss');
  assertEqual(props['Intent'].select.name, 'complaint');
  assert('Last Message' in props);
});

test('buildGuestLogProperties: unknown property excluded', () => {
  const stats = {
    thread_id: 'conv-123',
    total_messages: 3,
    escalated: false,
    status: 'Resolved',
    ai_response_rate: 100,
    latest_intent: null,
    last_message: null,
  };
  const props = buildGuestLogProperties(stats, 'Unknown');
  assert(!('Property' in props), 'Unknown property excluded from props');
  assert(!('Intent' in props), 'Null intent excluded from props');
  assert(!('Last Message' in props), 'Null last_message excluded from props');
});

test('buildGuestLogProperties: null property name', () => {
  const stats = { thread_id: 't1', total_messages: 1, escalated: false, status: 'Active', ai_response_rate: 0, latest_intent: null, last_message: null };
  const props = buildGuestLogProperties(stats, null);
  assert(!('Property' in props), 'Null property excluded');
});

test('buildGuestLogProperties: AI response rate 0%', () => {
  const stats = { thread_id: 't1', total_messages: 5, escalated: false, status: 'Active', ai_response_rate: 0, latest_intent: null, last_message: null };
  const props = buildGuestLogProperties(stats, 'Test');
  assertEqual(props['AI Response Rate'].number, 0);
});

// ── SYNC-GUESTS: findPropertyForThread ───────────────────

console.log('\n═══ SYNC-GUESTS: findPropertyForThread ═══');

// Inline pure function from sync-guests.js
function findPropertyForThread(conversation, clientConfig) {
  if (conversation.property_name) return conversation.property_name;
  if (conversation.property_slug) {
    const prop = clientConfig.properties.find(p => p.slug === conversation.property_slug);
    if (prop) return prop.name;
  }
  return null;
}

const mockClientConfig = {
  properties: [
    { slug: 'boho-bliss', name: 'Boho Bliss' },
    { slug: 'urban-nest', name: 'Urban Nest' },
  ],
};

test('findPropertyForThread: direct property_name', () => {
  assertEqual(findPropertyForThread({ property_name: 'Test Prop' }, mockClientConfig), 'Test Prop');
});

test('findPropertyForThread: slug lookup', () => {
  assertEqual(findPropertyForThread({ property_slug: 'boho-bliss' }, mockClientConfig), 'Boho Bliss');
});

test('findPropertyForThread: unknown slug → null', () => {
  assertEqual(findPropertyForThread({ property_slug: 'nonexistent' }, mockClientConfig), null);
});

test('findPropertyForThread: no property info → null', () => {
  assertEqual(findPropertyForThread({}, mockClientConfig), null);
});

// ── PARSER EDGE CASES ────────────────────────────────────

console.log('\n═══ PARSER EDGE CASES ═══');

test('parsePropertyMetrics: missing all fields', () => {
  const metrics = parsePropertyMetrics('This report has no recognizable metrics at all.');
  assert(metrics.occupancy_30n === null || metrics.occupancy_30n === undefined || typeof metrics.occupancy_30n === 'number', 'Occupancy handles missing data');
  assert(Array.isArray(metrics.risk_flags), 'risk_flags always an array');
});

test('parsePropertyMetrics: ADR "is" format', () => {
  const section = `### Metrics
- ADR is $185
- Occupancy: 70%`;
  const metrics = parsePropertyMetrics(section);
  assertEqual(metrics.adr, 185, 'ADR "is $185" format parsed');
});

test('markdownToNotionBlocks: empty input', () => {
  const blocks = markdownToNotionBlocks('');
  assert(Array.isArray(blocks), 'Returns array for empty input');
  assertEqual(blocks.length, 0, 'No blocks for empty input');
});

test('markdownToNotionBlocks: single heading only', () => {
  const blocks = markdownToNotionBlocks('# Title');
  assertEqual(blocks.length, 1, 'One block for single heading');
  assertEqual(blocks[0].type, 'heading_1');
});

test('aggregateConversation: zero guest messages', () => {
  const conv = {
    thread_id: 'empty-thread',
    messages: [
      { role: 'system', content: 'Init', timestamp: '2026-01-01T00:00:00Z' },
    ],
  };
  const stats = aggregateConversation(conv);
  assertEqual(stats.total_messages, 1);
  assertEqual(stats.ai_response_rate, 0);
});

test('aggregateConversation: all guest messages, no responses', () => {
  const conv = {
    thread_id: 'no-response',
    messages: [
      { role: 'guest', content: 'Hello?', timestamp: '2026-01-01T00:00:00Z' },
      { role: 'guest', content: 'Anyone?', timestamp: '2026-01-01T00:01:00Z' },
    ],
  };
  const stats = aggregateConversation(conv);
  assertEqual(stats.ai_response_rate, 0, 'No AI responses → 0% rate');
  assertEqual(stats.status, 'Active', 'Active when not escalated');
});

test('splitReportByProperty: Revenue-Intel format', () => {
  // Revenue-intel format requires: ## Revenue Engine Decisions section
  // with ### PropertyName headers inside it (see parsers.js line 79-117)
  const riReport = `# Solnest Stays — Revenue Intelligence Report
**Generated:** March 24, 2026

## Market Analysis & Recommendations
Claude analysis goes here.

## Revenue Engine Decisions

### Boho Bliss
**Pacing:** +15% vs last year
| Metric | Value |
| ADR | $150 |
| Occupancy (30N) | 72% |

### Urban Nest
**Pacing:** -5% vs last year
| Metric | Value |
| ADR | $200 |
| Occupancy (30N) | 80% |`;

  const sections = splitReportByProperty(riReport);
  assert(sections.length >= 2, `Expected 2+ sections, got ${sections.length}`);
  assert(sections.some(s => s.propertyName.includes('Boho')), 'Found Boho Bliss section');
  assert(sections.some(s => s.propertyName.includes('Urban')), 'Found Urban Nest section');
  // Verify date was extracted from **Generated:**
  assertEqual(sections[0].date, 'March 24, 2026', 'Date extracted from Generated header');
});

// ── Summary ─────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
