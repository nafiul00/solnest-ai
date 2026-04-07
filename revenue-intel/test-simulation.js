/**
 * Revenue Intel — Unit Tests
 *
 * Tests pure functions across the revenue-intel pipeline:
 * - python-bridge.js: transformToPropertyData(), data shape validation
 * - email.js: htmlEscape()
 * - slack.js: buildBlocks() (Block Kit formatting)
 * - tools/hospitable-tools.js: daysBetween(), data transformations
 *
 * Does NOT call real APIs. Usage: node test-simulation.js
 */

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

function assertEqual(actual, expected, label = '') {
  const name = label || `${actual} === ${expected}`;
  if (actual === expected) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

// ── Test 1: transformToPropertyData ─────────────────────

console.log('\n═══ Test 1: transformToPropertyData ═══');

// Inline the pure function from python-bridge.js
function transformToPropertyData(property, scrapedData) {
  const today = new Date();
  const calendar = [];
  const lastYearCalendar = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const basePrice = scrapedData.prices?.base || 200;

    calendar.push({
      date: dateStr,
      is_booked: false,
      price: basePrice,
      booked_on: null,
    });

    const ly = new Date(d);
    ly.setFullYear(ly.getFullYear() - 1);
    lastYearCalendar.push({
      date: ly.toISOString().split('T')[0],
      is_booked: false,
      price: Math.round(basePrice * 0.9),
      booked_on: null,
    });
  }

  return {
    property_id: property.name,
    base_price: scrapedData.prices?.base || 200,
    calendar,
    last_year_calendar: lastYearCalendar,
    comp_set: [],
    events: [],
    analysis_date: today.toISOString().split('T')[0],
  };
}

// Basic property transformation
const property = { name: 'Boho Bliss', hospitable_id: 'abc-123' };
const scrapedData = { prices: { base: 150, min: 100, max: 250 } };
const result = transformToPropertyData(property, scrapedData);

assertEqual(result.property_id, 'Boho Bliss', 'property_id from property.name');
assertEqual(result.base_price, 150, 'base_price from scraped data');
assertEqual(result.calendar.length, 30, 'calendar has 30 days');
assertEqual(result.last_year_calendar.length, 30, 'last_year_calendar has 30 days');
assert(Array.isArray(result.comp_set) && result.comp_set.length === 0, 'comp_set is empty array');
assert(Array.isArray(result.events) && result.events.length === 0, 'events is empty array');
assert(result.analysis_date.match(/^\d{4}-\d{2}-\d{2}$/), 'analysis_date is ISO date format');

// Calendar dates are sequential
const dates = result.calendar.map(d => d.date);
for (let i = 1; i < dates.length; i++) {
  assert(dates[i] > dates[i - 1], `Calendar date ${i} > date ${i-1}`);
}

// Last year calendar is ~365 days before current calendar
const currentFirst = new Date(result.calendar[0].date);
const lastYearFirst = new Date(result.last_year_calendar[0].date);
const daysDiff = Math.round((currentFirst - lastYearFirst) / (1000 * 60 * 60 * 24));
assert(daysDiff >= 365 && daysDiff <= 366, `Last year offset: ${daysDiff} days (~365)`);

// Last year prices are 90% of base
assertEqual(result.last_year_calendar[0].price, 135, 'Last year price is 90% of base (150 * 0.9 = 135)');

// All calendar entries have required shape
for (const entry of result.calendar) {
  assert('date' in entry && 'is_booked' in entry && 'price' in entry, `Calendar entry has required fields`);
}

// Missing scraped data → defaults to $200
const fallbackResult = transformToPropertyData(property, {});
assertEqual(fallbackResult.base_price, 200, 'Default base_price when no scraped data');
assertEqual(fallbackResult.calendar[0].price, 200, 'Default calendar price');
assertEqual(fallbackResult.last_year_calendar[0].price, 180, 'Default last year price (200 * 0.9)');

// Null prices object → defaults
const nullPricesResult = transformToPropertyData(property, { prices: null });
assertEqual(nullPricesResult.base_price, 200, 'Null prices → default base_price');

// ── Test 2: htmlEscape ──────────────────────────────────

console.log('\n═══ Test 2: htmlEscape ═══');

// Inline from email.js
function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

assertEqual(htmlEscape('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'XSS script tags escaped');
assertEqual(htmlEscape('Normal text'), 'Normal text', 'Normal text unchanged');
assertEqual(htmlEscape('&amp; already escaped'), '&amp;amp; already escaped', 'Double-escape prevention (ampersand)');
assertEqual(htmlEscape('Price: $185 "premium"'), 'Price: $185 &quot;premium&quot;', 'Quotes escaped');
assertEqual(htmlEscape(''), '', 'Empty string → empty');
assertEqual(htmlEscape(123), '123', 'Number → string');
assertEqual(htmlEscape(null), 'null', 'Null → "null" string');
assertEqual(htmlEscape(undefined), 'undefined', 'Undefined → "undefined" string');

// Multi-line content
const multiLine = 'Line 1\nLine 2\n<b>bold</b>';
assert(htmlEscape(multiLine).includes('&lt;b&gt;bold&lt;/b&gt;'), 'Multi-line HTML escaped');
assert(htmlEscape(multiLine).includes('\n'), 'Newlines preserved');

// ── Test 3: Slack buildBlocks ───────────────────────────

console.log('\n═══ Test 3: Slack buildBlocks ═══');

// Inline from slack.js
function buildBlocks(summary) {
  const blocks = [];

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: 'Solnest Stays — Daily Revenue Alert', emoji: true },
  });

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `*${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}*`,
    }],
  });

  blocks.push({ type: 'divider' });

  if (!summary || !summary.trim()) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_No summary data available._' },
    });
  } else {
    const sections = summary.split(/^## /m).filter(Boolean);
    let sectionsRendered = 0;
    const SLACK_BLOCK_LIMIT = 50;
    const RESERVED_TAIL = 2;

    for (const section of sections) {
      if (blocks.length + 3 + RESERVED_TAIL > SLACK_BLOCK_LIMIT) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: '_...report truncated — see full report in email_' },
        });
        break;
      }

      const lines = section.trim().split('\n');
      const title = lines[0].replace(/^#+\s*/, '').trim().substring(0, 150);
      const body = lines.slice(1).join('\n').trim();

      if (body) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${title}*` } });
        const truncatedBody = body.length > 2900
          ? body.substring(0, 2900) + '\n_(truncated — see full report in email)_'
          : body;
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: truncatedBody } });
      } else {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: title } });
      }

      blocks.push({ type: 'divider' });
      sectionsRendered++;
    }

    if (sectionsRendered === 0) {
      const truncated = summary.trim().length > 2900
        ? summary.trim().substring(0, 2900) + '\n_(truncated)_'
        : summary.trim();
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: truncated } });
    }
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: '_Solnest Revenue Intelligence Platform — Full report sent via weekly email_' }],
  });

  return blocks;
}

// Empty summary
const emptyBlocks = buildBlocks('');
assert(emptyBlocks.length >= 4, 'Empty summary: has header + context + divider + no-data + footer');
assert(emptyBlocks.some(b => b.text?.text?.includes('No summary data')), 'Empty summary: shows no-data message');

// Null summary
const nullBlocks = buildBlocks(null);
assert(nullBlocks.some(b => b.text?.text?.includes('No summary data')), 'Null summary: shows no-data message');

// Whitespace-only summary
const wsBlocks = buildBlocks('   \n\n  ');
assert(wsBlocks.some(b => b.text?.text?.includes('No summary data')), 'Whitespace summary: shows no-data message');

// Normal summary with sections
const normalSummary = `## Boho Bliss
Occupancy: 65%
ADR: $185

## Urban Nest
Occupancy: 78%
ADR: $220`;
const normalBlocks = buildBlocks(normalSummary);
assert(normalBlocks[0].type === 'header', 'Normal: starts with header');
assert(normalBlocks.some(b => b.text?.text === '*Boho Bliss*'), 'Normal: Boho Bliss section title');
assert(normalBlocks.some(b => b.text?.text === '*Urban Nest*'), 'Normal: Urban Nest section title');
const footerBlock = normalBlocks[normalBlocks.length - 1];
assert(footerBlock.type === 'context', 'Normal: ends with footer context');

// Summary without ## headers (raw text)
const rawSummary = 'Just a plain text summary with no markdown headers.';
const rawBlocks = buildBlocks(rawSummary);
assert(rawBlocks.some(b => b.text?.text?.includes('plain text summary')), 'Raw text: renders as section');

// Very long body truncation
const longBody = 'x'.repeat(3500);
const longSummary = `## Property\n${longBody}`;
const longBlocks = buildBlocks(longSummary);
const bodyBlock = longBlocks.find(b => b.text?.text?.includes('(truncated'));
assert(bodyBlock !== undefined, 'Long body: truncated message appended');
assert(bodyBlock.text.text.length <= 3000, 'Long body: under 3000 chars');

// Block limit (50 blocks)
let massiveSummary = '';
for (let i = 0; i < 30; i++) {
  massiveSummary += `## Property ${i}\nMetrics for property ${i}\n\n`;
}
const massiveBlocks = buildBlocks(massiveSummary);
assert(massiveBlocks.length <= 50, `Block limit: ${massiveBlocks.length} blocks ≤ 50`);

// Section with title only (no body)
const titleOnlySummary = `## Boho Bliss\n## Urban Nest`;
const titleBlocks = buildBlocks(titleOnlySummary);
assert(titleBlocks.some(b => b.text?.text === 'Boho Bliss'), 'Title-only: rendered as plain text');

// ── Test 4: daysBetween ─────────────────────────────────

console.log('\n═══ Test 4: daysBetween ═══');

// Inline from hospitable-tools.js
function daysBetween(start, end) {
  if (!start || !end) return 0;
  const d1 = new Date(start);
  const d2 = new Date(end);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

assertEqual(daysBetween('2026-03-01', '2026-03-10'), 9, '9 days between March 1-10');
assertEqual(daysBetween('2026-03-01', '2026-03-01'), 0, 'Same date = 0 days');
assertEqual(daysBetween('2026-03-10', '2026-03-01'), -9, 'Reverse order = negative');
assertEqual(daysBetween('2026-01-01', '2026-12-31'), 364, 'Full year = 364 days');
assertEqual(daysBetween(null, '2026-03-01'), 0, 'Null start = 0');
assertEqual(daysBetween('2026-03-01', null), 0, 'Null end = 0');
assertEqual(daysBetween('', ''), 0, 'Empty strings = 0');
assertEqual(daysBetween(undefined, undefined), 0, 'Undefined = 0');

// Leap year
assertEqual(daysBetween('2024-02-28', '2024-03-01'), 2, 'Leap year: Feb 28 to Mar 1 = 2 days');
assertEqual(daysBetween('2025-02-28', '2025-03-01'), 1, 'Non-leap: Feb 28 to Mar 1 = 1 day');

// Cross-year
assertEqual(daysBetween('2025-12-31', '2026-01-01'), 1, 'Cross-year boundary = 1 day');

// ── Test 5: Property Data Shape Validation ──────────────

console.log('\n═══ Test 5: Property Data Shape ═══');

// Validate the shape matches what the Python engine expects
const validData = transformToPropertyData(
  { name: 'Test Property' },
  { prices: { base: 175 } }
);

assert(typeof validData.property_id === 'string', 'property_id is string');
assert(typeof validData.base_price === 'number', 'base_price is number');
assert(validData.base_price > 0, 'base_price is positive');
assert(Array.isArray(validData.calendar), 'calendar is array');
assert(Array.isArray(validData.last_year_calendar), 'last_year_calendar is array');
assert(Array.isArray(validData.comp_set), 'comp_set is array');
assert(Array.isArray(validData.events), 'events is array');
assert(typeof validData.analysis_date === 'string', 'analysis_date is string');

// Each calendar entry matches Python PropertyData schema
const entry = validData.calendar[0];
assert(typeof entry.date === 'string', 'calendar[0].date is string');
assert(typeof entry.is_booked === 'boolean', 'calendar[0].is_booked is boolean');
assert(typeof entry.price === 'number', 'calendar[0].price is number');
assert(entry.booked_on === null, 'calendar[0].booked_on is null (default)');

// Last year entry shape
const lyEntry = validData.last_year_calendar[0];
assert(typeof lyEntry.date === 'string', 'last_year[0].date is string');
assert(typeof lyEntry.price === 'number', 'last_year[0].price is number');

// ── Test 6: Pacing Calculation ──────────────────────────

console.log('\n═══ Test 6: Pacing Calculation ═══');

// Test the delta calculation logic from getPacing()
function computeDelta(thisYear, lastYear) {
  return lastYear > 0
    ? Math.round(((thisYear - lastYear) / lastYear) * 100 * 10) / 10
    : null;
}

assertEqual(computeDelta(20, 15), 33.3, 'Pacing: 20 vs 15 = +33.3%');
assertEqual(computeDelta(10, 10), 0, 'Pacing: equal = 0%');
assertEqual(computeDelta(5, 10), -50, 'Pacing: 5 vs 10 = -50%');
assertEqual(computeDelta(10, 0), null, 'Pacing: last year 0 → null');
assertEqual(computeDelta(0, 0), null, 'Pacing: both 0 → null');
assertEqual(computeDelta(0, 10), -100, 'Pacing: 0 vs 10 = -100%');

// ── Test 7: Reservation Data Transform ──────────────────

console.log('\n═══ Test 7: Reservation Transform ═══');

// Test the mapping logic from getReservations()
function mapReservation(r) {
  return {
    id: r.id,
    check_in: (r.check_in || r.arrival_date || '').slice(0, 10),
    check_out: (r.check_out || r.departure_date || '').slice(0, 10),
    nights: r.nights || daysBetween((r.check_in || r.arrival_date || '').slice(0, 10), (r.check_out || r.departure_date || '').slice(0, 10)),
    total: r.total_price || r.payout || r.revenue,
    currency: r.currency || 'CAD',
    status: r.status,
    guest_name: r.guest?.name || r.guest_name || 'Unknown',
    source: r.source || r.channel || 'airbnb',
    created_at: r.created_at,
    booked_at: r.booked_at || r.created_at,
  };
}

// Standard reservation
const stdRes = mapReservation({
  id: 'res-1',
  check_in: '2026-03-25',
  check_out: '2026-03-28',
  nights: 3,
  total_price: 450,
  currency: 'CAD',
  status: 'accepted',
  guest: { name: 'John Doe' },
  source: 'airbnb',
  created_at: '2026-03-01',
  booked_at: '2026-03-01',
});
assertEqual(stdRes.id, 'res-1', 'Reservation ID preserved');
assertEqual(stdRes.check_in, '2026-03-25', 'Check-in date');
assertEqual(stdRes.nights, 3, 'Nights from reservation');
assertEqual(stdRes.total, 450, 'Total from total_price');
assertEqual(stdRes.guest_name, 'John Doe', 'Guest name from nested object');
assertEqual(stdRes.source, 'airbnb', 'Source preserved');

// Alternative field names (arrival_date, departure_date, payout)
const altRes = mapReservation({
  id: 'res-2',
  arrival_date: '2026-04-01',
  departure_date: '2026-04-05',
  payout: 600,
  status: 'accepted',
  guest_name: 'Jane Doe',
  channel: 'vrbo',
  created_at: '2026-03-15',
});
assertEqual(altRes.check_in, '2026-04-01', 'arrival_date mapped to check_in');
assertEqual(altRes.check_out, '2026-04-05', 'departure_date mapped to check_out');
assertEqual(altRes.nights, 4, 'Nights calculated via daysBetween');
assertEqual(altRes.total, 600, 'Payout mapped to total');
assertEqual(altRes.guest_name, 'Jane Doe', 'guest_name fallback');
assertEqual(altRes.source, 'vrbo', 'Channel mapped to source');
assertEqual(altRes.booked_at, '2026-03-15', 'booked_at fallback to created_at');

// Missing all optional fields → defaults
const minRes = mapReservation({
  id: 'res-3',
  status: 'pending',
  created_at: '2026-01-01',
});
assertEqual(minRes.check_in, '', 'Missing check_in → empty');
assertEqual(minRes.check_out, '', 'Missing check_out → empty');
assertEqual(minRes.nights, 0, 'Missing dates → 0 nights');
assertEqual(minRes.total, undefined, 'Missing total → undefined');
assertEqual(minRes.currency, 'CAD', 'Default currency CAD');
assertEqual(minRes.guest_name, 'Unknown', 'Default guest_name');
assertEqual(minRes.source, 'airbnb', 'Default source airbnb');

// Full ISO datetime truncated to date
const isoRes = mapReservation({
  id: 'res-4',
  check_in: '2026-05-01T14:00:00Z',
  check_out: '2026-05-05T10:00:00Z',
  nights: 4,
  status: 'accepted',
  created_at: '2026-04-20',
});
assertEqual(isoRes.check_in, '2026-05-01', 'ISO datetime truncated to date');
assertEqual(isoRes.check_out, '2026-05-05', 'ISO datetime truncated to date');

// ── Summary ─────────────────────────────────────────────

console.log('\n═══════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
}
