/**
 * Slack Alert Sender (Phase 5)
 *
 * Sends daily red-flag summaries to a Slack channel via webhook.
 * Uses Block Kit for structured formatting when possible,
 * falls back to plain text when no webhook configured.
 */

import 'dotenv/config';

/**
 * Send a daily summary alert to Slack with Block Kit formatting.
 *
 * @param {string} summary — Markdown summary of red flags and key findings
 * @returns {Promise<void>}
 */
export async function sendSlackAlert(summary) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[Slack] No SLACK_WEBHOOK_URL configured — logging to console instead.');
    console.log('[Slack] Daily Summary:');
    console.log(summary);
    return;
  }

  // Build Block Kit payload for rich formatting
  const blocks = buildBlocks(summary);

  const payload = {
    text: 'Solnest Stays — Daily Revenue Alert', // Fallback for notifications
    blocks,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`[Slack] Webhook failed: ${res.status} ${await res.text()}`);
    } else {
      console.log('[Slack] Daily alert sent.');
    }
  } catch (e) {
    console.error(`[Slack] Failed to send alert: ${e.message}`);
  }
}

/**
 * Build Slack Block Kit blocks from a markdown report.
 * Extracts red flags and key metrics for visual emphasis.
 */
function buildBlocks(summary) {
  const blocks = [];

  // Header
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

  // Guard: empty or whitespace-only summary
  if (!summary || !summary.trim()) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_No summary data available._' },
    });
  } else {
    // Split summary into sections (by markdown ## headers)
    const sections = summary.split(/^## /m).filter(Boolean);
    let sectionsRendered = 0;

    // Slack enforces a 50-block limit per message.
    // Reserve 2 slots: 1 for truncation notice + 1 for footer.
    // Each section can add up to 3 blocks (title + body + divider).
    const SLACK_BLOCK_LIMIT = 50;
    const RESERVED_TAIL = 2; // truncation message + footer

    for (const section of sections) {
      // Check if adding a full section (up to 3 blocks) would breach the limit
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
        // Section with header + body
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `*${title}*` },
        });

        const truncatedBody = body.length > 2900
          ? body.substring(0, 2900) + '\n_(truncated — see full report in email)_'
          : body;

        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: truncatedBody },
        });
      } else {
        // Single-line section (no body) — render title as content
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: title },
        });
      }

      blocks.push({ type: 'divider' });
      sectionsRendered++;
    }

    // If no sections were rendered (no ## headers found), send raw text
    if (sectionsRendered === 0) {
      const truncated = summary.trim().length > 2900
        ? summary.trim().substring(0, 2900) + '\n_(truncated)_'
        : summary.trim();

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: truncated },
      });
    }
  }

  // Footer
  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: '_Solnest Revenue Intelligence Platform — Full report sent via weekly email_',
    }],
  });

  return blocks;
}
