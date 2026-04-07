/**
 * Guest Communication AI — Webhook Server
 *
 * Receives guest messages via Hospitable webhooks, classifies intent,
 * generates grounded responses, and sends them back or escalates.
 *
 * Target: Sub-3-second response time. Zero hallucination.
 *
 * Usage:
 *   npm start           — production
 *   npm run dev          — watch mode (auto-restart on file changes)
 */

import express from 'express';
import 'dotenv/config';

import { verifyWebhookSignature } from './lib/security.js';
import { loadAllConfigs, getConfigByPropertyId } from './config/loader.js';
import { classifyMessage } from './lib/classifier.js';
import { generateResponse, preloadKnowledge } from './lib/responder.js';
import { sendMessage } from './lib/hospitable.js';
import { sendAlert } from './lib/alerts.js';
import {
  loadConversation,
  saveConversation,
  getRecentMessages,
} from './lib/conversation.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Track processed message IDs to prevent duplicates
const processedMessages = new Set();
const MAX_PROCESSED = 5000;

// Rate limiting: max 10 messages per conversation per minute
const rateLimits = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

function isRateLimited(conversationId) {
  const now = Date.now();
  const entry = rateLimits.get(conversationId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimits.set(conversationId, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Periodically clean stale rate limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of rateLimits) {
    if (now - entry.windowStart > RATE_WINDOW_MS * 2) {
      rateLimits.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

// ── Middleware ───────────────────────────────────────────

// Parse JSON and keep raw body for signature verification
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// ── Root ────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    service: 'Solnest Guest Agent',
    status: 'running',
    endpoints: {
      health: '/health',
      webhook: 'POST /webhook/message',
    },
    properties_loaded: 4,
    uptime: Math.floor(process.uptime()),
  });
});

// ── Health Check ────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ── Webhook: message.created ────────────────────────────

app.post('/webhook/message', async (req, res) => {
  const start = Date.now();

  // 1. Verify signature
  const signature = req.headers['x-hospitable-signature'];
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    console.error('[Webhook] Invalid signature — rejecting');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Acknowledge immediately (Hospitable needs 200 within 5s)
  res.status(200).json({ received: true });

  // 3. Process asynchronously
  try {
    await processMessage(req.body, start);
  } catch (err) {
    console.error(`[Webhook] Processing error: ${err.message}`);
    console.error(err.stack);
  }
});

// ── Message Processing Pipeline ─────────────────────────

async function processMessage(payload, startTime) {
  // Extract webhook data
  // Hospitable webhook payload structure may vary — adapt fields as needed
  const {
    id: messageId,
    conversation_id: conversationId,
    property_id: propertyId,
    body: messageBody,
    sender,
    reservation,
  } = normalizePayload(payload);

  // Skip if already processed (duplicate webhook delivery)
  if (processedMessages.has(messageId)) {
    console.log(`[Agent] Skipping duplicate message: ${messageId}`);
    return;
  }
  processedMessages.add(messageId);
  if (processedMessages.size > MAX_PROCESSED) {
    const first = processedMessages.values().next().value;
    processedMessages.delete(first);
  }

  // Skip messages sent by the host/AI (only respond to guest messages)
  if (sender?.type !== 'guest') {
    console.log(`[Agent] Skipping non-guest message from: ${sender?.type || 'unknown'}`);
    return;
  }

  // Skip empty messages
  if (!messageBody || messageBody.trim().length === 0) {
    console.log('[Agent] Skipping empty message');
    return;
  }

  // Rate limiting
  if (isRateLimited(conversationId)) {
    console.warn(`[Agent] Rate limited conversation: ${conversationId}`);
    return;
  }

  // Load client config
  const config = getConfigByPropertyId(propertyId);
  if (!config) {
    console.error(`[Agent] No config found for property: ${propertyId}`);
    return;
  }

  console.log(`[Agent] Processing message for ${config.property_name} from ${sender?.name || 'Guest'}`);

  // Load conversation history — get recent BEFORE pushing current message
  // to avoid duplicating current message in AI context
  const conversation = loadConversation(config.client_id, conversationId);

  // Store property metadata so notion-agent can link conversations to properties
  if (!conversation.property_name) conversation.property_name = config.property_name;
  if (!conversation.property_slug && config.property_slug) conversation.property_slug = config.property_slug;

  const recentMessages = getRecentMessages(conversation);

  // Now push current message for storage
  conversation.messages.push({
    role: 'guest',
    content: messageBody,
    timestamp: new Date().toISOString(),
  });

  // Wrap pipeline in try/finally to ensure conversation is ALWAYS saved
  // (even if classifier, responder, or alerts throw unexpectedly)
  try {
    // Classify intent
    const classification = await classifyMessage(messageBody, recentMessages, config);
    console.log(`[Agent] Intent: ${classification.intent} | Escalate: ${classification.escalate} | ${Date.now() - startTime}ms`);

    // Handle escalation
    if (classification.escalate) {
      await sendAlert({
        type: 'escalation',
        intent: classification.intent,
        guestMessage: messageBody,
        guestName: sender?.name || 'Guest',
        propertyName: config.property_name,
        channels: config.alert_channels,
        reason: classification.reason,
      });

      conversation.messages.push({
        role: 'system',
        content: `Escalated: ${classification.intent} — ${classification.reason}`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[Agent] Escalated to host via: ${config.alert_channels.join(', ')} | ${Date.now() - startTime}ms`);
      return;
    }

    // Generate response
    const bookingContext = {
      guest_name: sender?.name || reservation?.guest_name || 'Guest',
      check_in: reservation?.check_in,
      check_out: reservation?.check_out,
      guest_count: reservation?.guests,
    };

    const response = await generateResponse({
      message: messageBody,
      classification,
      recentMessages,
      clientConfig: config,
      bookingContext,
    });

    console.log(`[Agent] Response generated | ${Date.now() - startTime}ms`);

    // Auto-send or draft
    if (config.response_mode === 'auto_send') {
      try {
        await sendMessage(conversationId, response);
        conversation.messages.push({
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
          sent: true,
        });
        console.log(`[Agent] Response SENT via Hospitable | ${Date.now() - startTime}ms total`);
      } catch (err) {
        console.error(`[Agent] Failed to send via Hospitable: ${err.message}`);
        // Escalate on send failure — wrap in its own try/catch so a second
        // failure doesn't prevent conversation save
        try {
          await sendAlert({
            type: 'escalation',
            intent: 'send_failure',
            guestMessage: messageBody,
            guestName: sender?.name || 'Guest',
            propertyName: config.property_name,
            channels: config.alert_channels,
            reason: `Auto-send failed: ${err.message}. Draft: "${response}"`,
          });
        } catch (alertErr) {
          console.error(`[Agent] Alert also failed: ${alertErr.message}`);
        }
      }
    } else {
      // Draft + approve mode
      await sendAlert({
        type: 'draft_approval',
        intent: classification.intent,
        guestMessage: messageBody,
        guestName: sender?.name || 'Guest',
        propertyName: config.property_name,
        channels: config.alert_channels,
        draftResponse: response,
      });

      conversation.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        sent: false,
        status: 'draft',
      });
      console.log(`[Agent] Draft sent for approval | ${Date.now() - startTime}ms total`);
    }
  } finally {
    // ALWAYS save conversation — even on error, preserve guest message in history
    saveConversation(config.client_id, conversationId, conversation);
  }
}

// ── Payload Normalization ───────────────────────────────

/**
 * Normalize Hospitable webhook payload into consistent format.
 * Hospitable's webhook structure may vary — this handles differences.
 */
function normalizePayload(payload) {
  // Nested under data (common webhook pattern)
  if (payload.data) {
    return {
      id: payload.data.id || payload.id || fallbackId(payload),
      conversation_id: payload.data.conversation_id || payload.data.thread_id,
      property_id: payload.data.property_id || payload.data.listing_id,
      body: payload.data.body || payload.data.message || payload.data.content,
      sender: payload.data.sender || { type: 'guest', name: 'Guest' },
      reservation: payload.data.reservation || null,
    };
  }

  // Direct or fallback — always normalize to canonical field names
  return {
    id: payload.id || payload.message_id || fallbackId(payload),
    conversation_id: payload.conversation_id || payload.thread_id,
    property_id: payload.property_id || payload.listing_id,
    body: payload.body || payload.message || payload.content || '',
    sender: payload.sender || { type: 'guest', name: 'Guest' },
    reservation: payload.reservation || null,
  };
}

/**
 * Generate a deterministic fallback message ID from payload content.
 * Using a hash prevents the same re-delivered message from getting a new ID.
 */
function fallbackId(payload) {
  const content = payload.body || payload.message || payload.content
    || payload.data?.body || payload.data?.message || '';
  const convId = payload.conversation_id || payload.thread_id
    || payload.data?.conversation_id || payload.data?.thread_id || '';
  // Simple but deterministic: hash the content + conversation
  let hash = 0;
  const str = `${convId}:${content}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `msg-${Math.abs(hash).toString(36)}`;
}

// ── Startup ─────────────────────────────────────────────

// Validate critical env vars early so misconfigurations are caught at boot
if (!process.env.HOSPITABLE_WEBHOOK_SECRET) {
  console.warn('[Server] WARNING: HOSPITABLE_WEBHOOK_SECRET not set — ALL webhooks will be rejected (401).');
  console.warn('[Server] Set it in your .env file to accept webhooks from Hospitable.');
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[Server] WARNING: ANTHROPIC_API_KEY not set — classifier and responder will fail.');
}
if (!process.env.HOSPITABLE_PAT) {
  console.warn('[Server] WARNING: HOSPITABLE_PAT not set — sendMessage() to Hospitable will fail.');
}

console.log('[Server] Loading configs...');
loadAllConfigs();

console.log('[Server] Pre-loading knowledge bases...');
preloadKnowledge();

app.listen(PORT, () => {
  console.log(`[Server] Guest Agent running on port ${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/health`);
  console.log(`[Server] Webhook: POST http://localhost:${PORT}/webhook/message`);
});
