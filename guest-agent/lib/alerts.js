/**
 * Multi-Channel Alerts
 *
 * Sends escalation and draft-approval alerts via:
 * - Slack (webhook)
 * - WhatsApp (Twilio)
 * - Email (Gmail SMTP via nodemailer)
 *
 * Client config controls which channels are active.
 */

import nodemailer from 'nodemailer';
import 'dotenv/config';

// ── Slack ───────────────────────────────────────────────

async function sendSlack(text) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Alerts] SLACK_WEBHOOK_URL not configured, skipping Slack');
    return false;
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status}`);
  }
  return true;
}

// ── WhatsApp (Twilio) ───────────────────────────────────

async function sendWhatsApp(text) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER, HOST_WHATSAPP_NUMBER } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('[Alerts] Twilio not configured, skipping WhatsApp');
    return false;
  }

  if (!TWILIO_WHATSAPP_NUMBER || !HOST_WHATSAPP_NUMBER) {
    console.warn('[Alerts] WhatsApp numbers not configured, skipping WhatsApp');
    return false;
  }

  const { default: twilio } = await import('twilio');
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  await client.messages.create({
    from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${HOST_WHATSAPP_NUMBER}`,
    body: text,
  });
  return true;
}

// ── Email ───────────────────────────────────────────────

async function sendEmail(subject, text) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD, HOST_EMAIL } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn('[Alerts] Gmail not configured, skipping email');
    return false;
  }

  if (!HOST_EMAIL) {
    console.warn('[Alerts] HOST_EMAIL not configured, skipping email');
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  await transporter.sendMail({
    from: GMAIL_USER,
    to: HOST_EMAIL,
    subject,
    text,
  });
  return true;
}

// ── Public API ──────────────────────────────────────────

/**
 * Send an alert to all configured channels.
 *
 * @param {Object} params
 * @param {string} params.type - Alert type: 'escalation' | 'draft_approval'
 * @param {string} params.intent - Message intent (complaint, emergency, etc.)
 * @param {string} params.guestMessage - Original guest message
 * @param {string} params.guestName - Guest name
 * @param {string} params.propertyName - Property name
 * @param {string[]} params.channels - Active channels from client config
 * @param {string} [params.draftResponse] - AI draft (for draft_approve mode)
 * @param {string} [params.reason] - Escalation reason
 */
export async function sendAlert({
  type,
  intent,
  guestMessage,
  guestName,
  propertyName,
  channels,
  draftResponse,
  reason,
}) {
  let text;
  let subject;

  if (type === 'draft_approval') {
    subject = `[Draft] ${propertyName} — ${guestName}`;
    text = [
      `📝 DRAFT RESPONSE — ${propertyName}`,
      ``,
      `Guest: ${guestName}`,
      `Message: "${guestMessage}"`,
      ``,
      `Proposed response:`,
      `"${draftResponse}"`,
      ``,
      `Reply to approve or edit.`,
    ].join('\n');
  } else {
    const icon = intent === 'emergency' ? '🚨' : '⚠️';
    subject = `${icon} ${intent.toUpperCase()} — ${propertyName}`;
    text = [
      `${icon} ESCALATION: ${intent.toUpperCase()}`,
      ``,
      `Property: ${propertyName}`,
      `Guest: ${guestName}`,
      `Message: "${guestMessage}"`,
      reason ? `Reason: ${reason}` : '',
      ``,
      `Please respond to this guest directly.`,
    ].filter(Boolean).join('\n');
  }

  const CHANNEL_HANDLERS = {
    slack: () => sendSlack(text),
    whatsapp: () => sendWhatsApp(text),
    email: () => sendEmail(subject, text),
  };

  const results = [];

  for (const channel of channels) {
    const handler = CHANNEL_HANDLERS[channel];
    if (!handler) {
      console.warn(`[Alerts] Unknown channel: ${channel}, skipping`);
      results.push({ channel, status: 'skipped', error: 'Unknown channel' });
      continue;
    }

    try {
      const sent = await handler();
      results.push({ channel, status: sent ? 'sent' : 'skipped' });
    } catch (err) {
      console.error(`[Alerts] ${channel} failed: ${err.message}`);
      results.push({ channel, status: 'failed', error: err.message });
    }
  }

  const sentChannels = results.filter(r => r.status === 'sent').map(r => r.channel);
  const skippedChannels = results.filter(r => r.status === 'skipped').map(r => r.channel);
  console.log(`[Alerts] ${type} sent to: ${sentChannels.join(', ') || 'none'}${skippedChannels.length ? ` (skipped: ${skippedChannels.join(', ')})` : ''}`);
  return results;
}
