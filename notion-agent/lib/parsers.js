/**
 * Data Parsers
 *
 * Parses revenue-intel reports (primary) and legacy pricelabs-agent reports (fallback),
 * plus guest-agent conversation JSONs. Also converts markdown to Notion block objects.
 *
 * Revenue-intel report format (from orchestrator.js buildReport):
 *   # Solnest Stays — Revenue Intelligence Report
 *   **Generated:** ...
 *   ## Market Analysis & Recommendations
 *   [Claude's analysis]
 *   ## Revenue Engine Decisions
 *   ### PropertyName
 *   **Pacing:** ... **Market Position:** ... **Risk Level:** ...
 *   | Metric | Value |  (ADR, Occupancy, RevPAR, Total Revenue)
 *   **Pricing Decisions:** (table)
 *   **Issues Detected:** (bullets)
 *   **Next Actions:** (bullets)
 *
 * Legacy pricelabs-agent format (from analyze.js):
 *   # [Property Name] — Weekly Pricing Report
 *   **Date:** ...
 *   **Occupancy:** [7N / 30N / 60N]
 *   ## Market Position
 *   ## Calendar Analysis
 *   ## Risk Flags
 *
 * Guest conversation format (from conversation.js):
 *   { thread_id, client_id, messages: [{ role, content, timestamp, sent?, status? }] }
 */

import fs from 'fs';
import path from 'path';

// ── Report File Discovery ───────────────────────────────

/**
 * Find the most recent report file in a directory.
 * Supports both revenue-intel (revenue-intel-*.md) and legacy (report-*.md) filenames.
 * Sorts by file modification time for reliability across naming conventions.
 */
export function findLatestReport(reportsDir) {
  if (!fs.existsSync(reportsDir)) return null;

  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(reportsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? path.join(reportsDir, files[0].name) : null;
}

// ── Report Splitting ────────────────────────────────────

/**
 * Split a report into per-property sections.
 * Returns array of { propertyName, rawSection, date }.
 *
 * Auto-detects format:
 * 1. Revenue-intel: ### PropertyName under ## Revenue Engine Decisions
 * 2. Legacy: # PropertyName — Weekly Pricing Report with **Date:**
 */
export function splitReportByProperty(reportMarkdown) {
  // Try revenue-intel format first
  const revenueIntelSections = splitRevenueIntelFormat(reportMarkdown);
  if (revenueIntelSections.length > 0) return revenueIntelSections;

  // Fall back to legacy pricelabs-agent format
  return splitLegacyFormat(reportMarkdown);
}

/**
 * Split revenue-intel format report by property.
 * Finds ### headers within the ## Revenue Engine Decisions section.
 */
function splitRevenueIntelFormat(reportMarkdown) {
  // Extract report date from header
  const dateMatch = reportMarkdown.match(/\*\*Generated:\*\*\s*(.+)/);
  const date = dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0];

  // Extract engine decisions section and strip trailing footer
  let engineSection = extractSection(reportMarkdown, 'Revenue Engine Decisions');
  if (!engineSection) return [];

  // Remove trailing report footer (--- followed by italic lines)
  engineSection = engineSection.replace(/\n---\s*\n[\s\S]*$/, '').trim();

  // Split by ### property headers within engine section
  const headingRegex = /^### (.+)/gm;
  const matches = [];
  let match;
  while ((match = headingRegex.exec(engineSection)) !== null) {
    matches.push({
      propertyName: match[1].trim(),
      startIndex: match.index,
    });
  }

  if (matches.length === 0) return [];

  const properties = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].startIndex;
    const end = i < matches.length - 1 ? matches[i + 1].startIndex : engineSection.length;
    const rawSection = engineSection.slice(start, end).trim();

    properties.push({
      propertyName: matches[i].propertyName,
      rawSection,
      date,
    });
  }

  return properties;
}

/**
 * Split legacy pricelabs-agent format report by property.
 * Finds # PropertyName — Weekly Pricing Report headers with **Date:** lines.
 */
function splitLegacyFormat(reportMarkdown) {
  const headingRegex = /^# (.+?)\s*—\s*Weekly Pricing Report/gm;
  const matches = [];
  let match;

  while ((match = headingRegex.exec(reportMarkdown)) !== null) {
    matches.push({
      propertyName: match[1].trim(),
      startIndex: match.index,
    });
  }

  const properties = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].startIndex;
    const end = i < matches.length - 1 ? matches[i + 1].startIndex : reportMarkdown.length;
    const rawSection = reportMarkdown.slice(start, end).trim().replace(/\n---\s*$/, '').trim();

    // Property sections have **Date:**, the main header has **Generated:** instead
    const dateMatch = rawSection.match(/\*\*Date:\*\*\s*(.+)/);
    if (!dateMatch) continue;

    properties.push({
      propertyName: matches[i].propertyName,
      rawSection,
      date: dateMatch[1].trim(),
    });
  }

  return properties;
}

// ── Metrics Extraction ──────────────────────────────────

/**
 * Parse metrics from a single property's report section.
 * Handles both revenue-intel table format and legacy prose format.
 * Extracts numbers where available, returns null for missing values.
 */
export function parsePropertyMetrics(rawSection) {
  const metrics = {
    occupancy_7n: null,
    occupancy_30n: null,
    occupancy_60n: null,
    adr: null,
    revenue_mtd: null,
    revpar: null,
    avg_lead_time: null,
    comp_set_rank: null,
    risk_flags: [],
  };

  // ── Revenue-intel table format (try first — more specific) ──

  // | ADR | $200.00 |
  const tableAdr = rawSection.match(/\|\s*ADR\s*\|\s*\$?([\d,.]+)/i);
  if (tableAdr) metrics.adr = parseFloat(tableAdr[1].replace(/,/g, ''));

  // | Occupancy | 65.0% |
  const tableOcc = rawSection.match(/\|\s*Occupancy\s*\|\s*([\d.]+)%?/i);
  if (tableOcc) metrics.occupancy_30n = parseFloat(tableOcc[1]);

  // | RevPAR | $130.00 |
  const tableRevpar = rawSection.match(/\|\s*RevPAR\s*\|\s*\$?([\d,.]+)/i);
  if (tableRevpar) metrics.revpar = parseFloat(tableRevpar[1].replace(/,/g, ''));

  // | Total Revenue | $6000.00 |
  const tableRev = rawSection.match(/\|\s*Total Revenue\s*\|\s*\$?([\d,.]+)/i);
  if (tableRev) metrics.revenue_mtd = parseFloat(tableRev[1].replace(/,/g, ''));

  // **Market Position:** above_market
  const inlineMarket = rawSection.match(/\*\*Market Position:\*\*\s*(.+)/);
  if (inlineMarket) {
    const pos = inlineMarket[1].trim().toLowerCase();
    if (pos.includes('above')) metrics.comp_set_rank = 'Above Market';
    else if (pos.includes('below')) metrics.comp_set_rank = 'Below Market';
    else metrics.comp_set_rank = 'At Market';
  }

  // **Risk Level:** high/medium/low
  const riskLevel = rawSection.match(/\*\*Risk Level:\*\*\s*(.+)/);
  if (riskLevel) {
    const level = riskLevel[1].trim().toLowerCase();
    if (level.includes('high')) metrics.risk_flags.push('Review Needed');
  }

  // **Issues Detected:** followed by bullet list
  const issuesMatch = rawSection.match(/\*\*Issues Detected:\*\*\n((?:\s*-\s*.+\n?)*)/);
  if (issuesMatch) {
    const issueLines = issuesMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
    for (const line of issueLines) {
      const text = line.toLowerCase();
      if (/orphan/.test(text) && !metrics.risk_flags.includes('Orphan Days')) metrics.risk_flags.push('Orphan Days');
      if (/gap/.test(text) && !metrics.risk_flags.includes('Gap Days')) metrics.risk_flags.push('Gap Days');
      if (/low.?occupancy/.test(text) && !metrics.risk_flags.includes('Low Occupancy')) metrics.risk_flags.push('Low Occupancy');
      if (/below.?market/.test(text) && !metrics.risk_flags.includes('Below Market')) metrics.risk_flags.push('Below Market');
      if (/min.?(floor|price)/.test(text) && !metrics.risk_flags.includes('Min Floor Hit')) metrics.risk_flags.push('Min Floor Hit');
      if (/demand/.test(text) && !metrics.risk_flags.includes('Demand Factor Off')) metrics.risk_flags.push('Demand Factor Off');
    }
  }

  // ── Legacy format (only fill values not already found) ──

  // Parse occupancy: **Occupancy:** 71% / 65% / 58%
  if (metrics.occupancy_30n == null) {
    const occMatch = rawSection.match(/\*\*Occupancy:\*\*\s*([\d.]+)%?\s*\/\s*([\d.]+)%?\s*\/\s*([\d.]+)%?/);
    if (occMatch) {
      metrics.occupancy_7n = parseFloat(occMatch[1]);
      metrics.occupancy_30n = parseFloat(occMatch[2]);
      metrics.occupancy_60n = parseFloat(occMatch[3]);
    }
  }

  // Parse ADR from content
  if (metrics.adr == null) {
    const adrMatch = rawSection.match(/ADR[\s:]+(?:is\s+)?\$?([\d,.]+)/i) ||
      rawSection.match(/\$([\d,.]+)\s*(?:ADR|average daily rate)/i);
    if (adrMatch) metrics.adr = parseFloat(adrMatch[1].replace(/,/g, ''));
  }

  // Parse RevPAR
  if (metrics.revpar == null) {
    const revparMatch = rawSection.match(/RevPAR[\s:of]+\$?([\d,.]+)/i) ||
      rawSection.match(/\$([\d,.]+)\s*RevPAR/i);
    if (revparMatch) metrics.revpar = parseFloat(revparMatch[1].replace(/,/g, ''));
  }

  // Parse revenue
  if (metrics.revenue_mtd == null) {
    const revMatch = rawSection.match(/revenue[:\s]+\$?([\d,.]+)/i);
    if (revMatch) metrics.revenue_mtd = parseFloat(revMatch[1].replace(/,/g, ''));
  }

  // Parse lead time
  if (metrics.avg_lead_time == null) {
    const leadMatch = rawSection.match(/lead\s*time[\s:averaging]+([\d.]+)\s*day/i) ||
      rawSection.match(/([\d.]+)[\s-]*day\s*lead\s*time/i);
    if (leadMatch) metrics.avg_lead_time = parseFloat(leadMatch[1]);
  }

  // Determine comp set rank from Market Position section (legacy)
  if (!metrics.comp_set_rank) {
    const marketSection = extractSection(rawSection, 'Market Position');
    if (marketSection) {
      const lower = marketSection.toLowerCase();
      if (lower.includes('above market') || lower.includes('above the market') || lower.includes('above median')) {
        metrics.comp_set_rank = 'Above Market';
      } else if (lower.includes('below market') || lower.includes('below the market') || lower.includes('below median')) {
        metrics.comp_set_rank = 'Below Market';
      } else {
        metrics.comp_set_rank = 'At Market';
      }
    }
  }

  // Parse risk flags from ## Risk Flags section (legacy)
  if (metrics.risk_flags.length === 0) {
    const riskSection = extractSection(rawSection, 'Risk Flags');
    if (riskSection) {
      // Skip if the section explicitly says there are no risks
      const noRiskPattern = /\bno\s+(significant\s+)?risk|\bperformance\s+is\s+strong\b|\bno\s+concerns\b|\ball\s+clear\b/i;
      if (!noRiskPattern.test(riskSection)) {
        if (/low\s*occupancy/i.test(riskSection)) metrics.risk_flags.push('Low Occupancy');
        if (/gap\s*day/i.test(riskSection)) metrics.risk_flags.push('Gap Days');
        if (/min\s*(floor|price)/i.test(riskSection)) metrics.risk_flags.push('Min Floor Hit');
        if (/demand\s*factor/i.test(riskSection)) metrics.risk_flags.push('Demand Factor Off');
        if (/below\s*market/i.test(riskSection)) metrics.risk_flags.push('Below Market');
        if (/orphan/i.test(riskSection)) metrics.risk_flags.push('Orphan Days');
        // If there are risk flags but none matched our patterns, add a generic one
        if (metrics.risk_flags.length === 0 && riskSection.trim().length > 20) {
          metrics.risk_flags.push('Review Needed');
        }
      }
    }
  }

  return metrics;
}

/**
 * Extract a named section from markdown (from ## Header to next ## or end).
 */
function extractSection(markdown, sectionName) {
  const regex = new RegExp(`## ${sectionName}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = markdown.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Generate a short executive summary from a report section.
 * Handles both revenue-intel (Pacing/table metrics) and legacy (Occupancy line) formats.
 */
export function generateSummary(rawSection) {
  const parts = [];

  // Revenue-intel format: **Pacing:** ahead_of_pace
  const pacingMatch = rawSection.match(/\*\*Pacing:\*\*\s*(.+)/);
  if (pacingMatch) parts.push(`Pacing: ${pacingMatch[1].trim()}`);

  const metrics = parsePropertyMetrics(rawSection);

  if (metrics.occupancy_30n != null) {
    parts.push(`Occupancy: ${metrics.occupancy_30n}%`);
  } else {
    // Legacy: raw occupancy line
    const occMatch = rawSection.match(/\*\*Occupancy:\*\*\s*(.+)/);
    if (occMatch) parts.push(`Occupancy: ${occMatch[1].trim()}`);
  }

  if (metrics.comp_set_rank) parts.push(`Market: ${metrics.comp_set_rank}`);
  if (metrics.risk_flags.length > 0) parts.push(`Risks: ${metrics.risk_flags.join(', ')}`);

  return parts.length > 0 ? parts.join(' | ') : 'Report available — see details below.';
}

// ── Guest Conversation Parser ───────────────────────────

/**
 * Read all conversation files from a client's conversations directory.
 * Returns array of parsed conversation objects.
 */
export function readConversations(conversationsDir) {
  if (!fs.existsSync(conversationsDir)) return [];

  const conversations = [];
  const files = fs.readdirSync(conversationsDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(conversationsDir, file), 'utf-8');
      const conversation = JSON.parse(raw);
      conversations.push(conversation);
    } catch (err) {
      console.warn(`[Parsers] Failed to read conversation ${file}: ${err.message}`);
    }
  }

  return conversations;
}

/**
 * Aggregate stats for a single conversation thread.
 */
export function aggregateConversation(conversation) {
  const messages = conversation.messages || [];
  const guestMessages = messages.filter(m => m.role === 'guest');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  const systemMessages = messages.filter(m => m.role === 'system');

  const sentMessages = assistantMessages.filter(m => m.sent === true);
  const escalated = systemMessages.some(m => /escalat/i.test(m.content));

  // Extract intents from system messages (format: "Escalated: intent — reason")
  const intents = systemMessages
    .map(m => {
      const match = m.content.match(/Escalated:\s*(\w+)/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  // Get most recent message timestamp
  const allTimestamps = messages.map(m => m.timestamp).filter(Boolean);
  const lastMessage = allTimestamps.length > 0
    ? allTimestamps.sort((a, b) => new Date(b) - new Date(a))[0]
    : conversation.updated_at || conversation.created_at;

  // Determine status
  let status = 'Active';
  if (escalated) status = 'Escalated';
  else if (messages.length > 0 && assistantMessages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant') status = 'Resolved';
  }

  return {
    thread_id: conversation.thread_id,
    client_id: conversation.client_id,
    total_messages: messages.length,
    guest_messages: guestMessages.length,
    assistant_messages: assistantMessages.length,
    sent_messages: sentMessages.length,
    last_message: lastMessage,
    escalated,
    intents,
    latest_intent: intents.length > 0 ? intents[intents.length - 1] : 'faq',
    status,
    ai_response_rate: guestMessages.length > 0
      ? Math.round((sentMessages.length / guestMessages.length) * 100)
      : 0,
  };
}

// ── Markdown → Notion Blocks ────────────────────────────

/**
 * Convert markdown string to Notion block objects.
 * Handles: headings, bullet lists, numbered lists, tables, dividers, callouts, paragraphs.
 */
export function markdownToNotionBlocks(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Divider
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'divider', divider: {} });
      i++;
      continue;
    }

    // Heading 1
    if (/^# /.test(line)) {
      blocks.push(heading(1, line.replace(/^# /, '').trim()));
      i++;
      continue;
    }

    // Heading 2
    if (/^## /.test(line)) {
      blocks.push(heading(2, line.replace(/^## /, '').trim()));
      i++;
      continue;
    }

    // Heading 3
    if (/^### /.test(line)) {
      blocks.push(heading(3, line.replace(/^### /, '').trim()));
      i++;
      continue;
    }

    // Callout (blockquote)
    if (/^> /.test(line)) {
      const text = line.replace(/^> /, '').trim();
      blocks.push({
        type: 'callout',
        callout: {
          rich_text: parseInlineFormatting(text),
          icon: { emoji: '💡' },
        },
      });
      i++;
      continue;
    }

    // Table — collect all consecutive | rows
    if (/^\|/.test(line.trim())) {
      const tableLines = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      const tableBlock = parseTable(tableLines);
      if (tableBlock) blocks.push(tableBlock);
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, '').trim();
      blocks.push({
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseInlineFormatting(text) },
      });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      const text = line.replace(/^[-*]\s/, '').trim();
      blocks.push({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseInlineFormatting(text) },
      });
      i++;
      continue;
    }

    // Empty line — skip
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph (default)
    blocks.push({
      type: 'paragraph',
      paragraph: { rich_text: parseInlineFormatting(line.trim()) },
    });
    i++;
  }

  return blocks;
}

/**
 * Create a heading block.
 */
function heading(level, text) {
  const type = `heading_${level}`;
  return {
    type,
    [type]: { rich_text: parseInlineFormatting(text) },
  };
}

/**
 * Parse inline markdown formatting into Notion rich_text array.
 * Handles: **bold**, *italic*, `code`.
 * Enforces Notion's 2000-char limit per text block.
 */
function parseInlineFormatting(text) {
  const parts = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (boldMatch) {
      if (boldMatch[1]) pushTextChunks(parts, boldMatch[1]);
      pushTextChunks(parts, boldMatch[2], { bold: true });
      remaining = boldMatch[3];
      continue;
    }

    // Italic: *text*
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)/s);
    if (italicMatch) {
      if (italicMatch[1]) pushTextChunks(parts, italicMatch[1]);
      pushTextChunks(parts, italicMatch[2], { italic: true });
      remaining = italicMatch[3];
      continue;
    }

    // Code: `text`
    const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)/s);
    if (codeMatch) {
      if (codeMatch[1]) pushTextChunks(parts, codeMatch[1]);
      pushTextChunks(parts, codeMatch[2], { code: true });
      remaining = codeMatch[3];
      continue;
    }

    // No more formatting — push rest as plain text
    pushTextChunks(parts, remaining);
    break;
  }

  return parts.length > 0 ? parts : [{ type: 'text', text: { content: text.slice(0, NOTION_TEXT_LIMIT) } }];
}

/**
 * Notion limits each rich_text content block to 2000 characters.
 * Split long text into multiple blocks with the same annotations.
 */
const NOTION_TEXT_LIMIT = 2000;

function pushTextChunks(parts, content, annotations) {
  for (let i = 0; i < content.length; i += NOTION_TEXT_LIMIT) {
    const chunk = content.slice(i, i + NOTION_TEXT_LIMIT);
    const block = { type: 'text', text: { content: chunk } };
    if (annotations) block.annotations = annotations;
    parts.push(block);
  }
}

/**
 * Parse markdown table lines into a Notion table block.
 */
function parseTable(tableLines) {
  // Filter out separator rows (| --- | --- |)
  const dataRows = tableLines.filter(line => !/^\|[\s\-:|]+\|$/.test(line.trim()));
  if (dataRows.length === 0) return null;

  const parsedRows = dataRows.map(line => {
    const cells = line
      .split('|')
      .slice(1, -1) // Remove empty first/last from | split
      .map(cell => cell.trim());
    return cells;
  });

  const columnCount = parsedRows[0]?.length || 0;
  if (columnCount === 0) return null;

  // Normalize: all rows must have exactly columnCount cells (Notion rejects mismatched widths)
  const normalizedRows = parsedRows.map(cells => {
    if (cells.length === columnCount) return cells;
    if (cells.length > columnCount) return cells.slice(0, columnCount);
    return [...cells, ...Array(columnCount - cells.length).fill('')];
  });

  return {
    type: 'table',
    table: {
      table_width: columnCount,
      has_column_header: true,
      has_row_header: false,
      children: normalizedRows.map(cells => ({
        type: 'table_row',
        table_row: {
          cells: cells.map(cell => [{ type: 'text', text: { content: cell.slice(0, NOTION_TEXT_LIMIT) } }]),
        },
      })),
    },
  };
}
