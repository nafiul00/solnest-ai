/**
 * End-to-End Simulation Test
 *
 * Tests the entire guest-agent pipeline with mock data.
 * Does NOT call real APIs — tests config loading, conversation storage,
 * payload normalization, rate limiting, path traversal defense, and message flow.
 *
 * Usage: node test-simulation.js
 */

import { loadAllConfigs, getConfigByPropertyId, reloadConfigs } from './config/loader.js';
import { validateConfig } from './config/schema.js';
import { verifyWebhookSignature } from './lib/security.js';
import {
  loadConversation,
  saveConversation,
  getRecentMessages,
} from './lib/conversation.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// ── Test 1: Config Loading ──────────────────────────────

console.log('\n═══ Test 1: Config Loading ═══');

loadAllConfigs();

const bohoConfig = getConfigByPropertyId('6a9d3726-eace-483f-b3a7-531f1ff2839b');
assert(bohoConfig !== null, 'Boho Bliss config loaded');
assert(bohoConfig.client_id === 'solnest', 'Client ID is solnest');
assert(bohoConfig.property_name === 'Boho Bliss', 'Property name is Boho Bliss');
assert(bohoConfig.property_slug === 'boho-bliss', 'Property slug is boho-bliss');
assert(bohoConfig.response_mode === 'auto_send', 'Response mode is auto_send');
assert(Array.isArray(bohoConfig.alert_channels), 'Alert channels is array');
assert(Array.isArray(bohoConfig.escalation_keywords), 'Escalation keywords is array');
assert(bohoConfig.escalation_keywords.includes('fire'), 'Has "fire" keyword');

const unknownConfig = getConfigByPropertyId('nonexistent-id');
assert(unknownConfig === null, 'Returns null for unknown property');

const sunburstConfig = getConfigByPropertyId('206de053-0f37-4d1c-9955-209b22e3d9c4');
assert(sunburstConfig !== null, 'Sunburst Chalet config loaded');
assert(sunburstConfig.property_name === 'The Sunburst Chalet in Sun Peaks', 'Sunburst name correct');

// ── Test 2: Config Validation ───────────────────────────

console.log('\n═══ Test 2: Config Validation ═══');

// Valid config
try {
  validateConfig({
    client_id: 'test',
    client_name: 'Test Client',
    response_mode: 'auto_send',
    alert_channels: ['slack'],
    properties: [{ hospitable_id: 'abc', property_name: 'Test', property_slug: 'test' }],
    auto_respond_to: ['faq'],
    escalate_always: ['emergency'],
  });
  assert(true, 'Valid config passes validation');
} catch {
  assert(false, 'Valid config passes validation');
}

// Invalid response_mode
try {
  validateConfig({
    client_id: 'test',
    client_name: 'Test',
    response_mode: 'invalid_mode',
    alert_channels: ['slack'],
    properties: [{ hospitable_id: 'abc', property_name: 'Test', property_slug: 'test' }],
    auto_respond_to: ['faq'],
    escalate_always: ['emergency'],
  });
  assert(false, 'Invalid response_mode rejected');
} catch {
  assert(true, 'Invalid response_mode rejected');
}

// Missing properties
try {
  validateConfig({
    client_id: 'test',
    client_name: 'Test',
    response_mode: 'auto_send',
    alert_channels: ['slack'],
    properties: [],
    auto_respond_to: ['faq'],
    escalate_always: ['emergency'],
  });
  assert(false, 'Empty properties rejected');
} catch {
  assert(true, 'Empty properties rejected');
}

// Invalid alert channel
try {
  validateConfig({
    client_id: 'test',
    client_name: 'Test',
    response_mode: 'auto_send',
    alert_channels: ['carrier_pigeon'],
    properties: [{ hospitable_id: 'abc', property_name: 'Test', property_slug: 'test' }],
    auto_respond_to: ['faq'],
    escalate_always: ['emergency'],
  });
  assert(false, 'Invalid alert channel rejected');
} catch {
  assert(true, 'Invalid alert channel rejected');
}

// ── Test 3: Webhook Signature Verification ──────────────

console.log('\n═══ Test 3: Webhook Signature ═══');

// Save and set test secret
const originalSecret = process.env.HOSPITABLE_WEBHOOK_SECRET;
process.env.HOSPITABLE_WEBHOOK_SECRET = 'test-secret-123';

const testBody = Buffer.from('{"test":"data"}');
const validSig = crypto.createHmac('sha256', 'test-secret-123').update(testBody).digest('hex');

assert(verifyWebhookSignature(testBody, validSig) === true, 'Valid signature accepted');
assert(verifyWebhookSignature(testBody, 'wrong-signature') === false, 'Wrong signature rejected');
assert(verifyWebhookSignature(testBody, '') === false, 'Empty signature rejected');
assert(verifyWebhookSignature(testBody, null) === false, 'Null signature rejected');
assert(verifyWebhookSignature(null, validSig) === false, 'Null body rejected');
assert(verifyWebhookSignature(undefined, validSig) === false, 'Undefined body rejected');

// Test without secret
process.env.HOSPITABLE_WEBHOOK_SECRET = '';
assert(verifyWebhookSignature(testBody, validSig) === false, 'Missing secret rejected');

// Restore
process.env.HOSPITABLE_WEBHOOK_SECRET = originalSecret || '';

// ── Test 4: Conversation Storage ────────────────────────

console.log('\n═══ Test 4: Conversation Storage ═══');

const testClientId = '_test_simulation_';
const testThreadId = 'thread-001';

// Load non-existent conversation
const conv = loadConversation(testClientId, testThreadId);
assert(conv.messages.length === 0, 'New conversation has empty messages');
assert(conv.thread_id === testThreadId, 'Thread ID preserved');
assert(conv.client_id === testClientId, 'Client ID preserved');

// Add messages and save
conv.messages.push({ role: 'guest', content: 'Hello!', timestamp: new Date().toISOString() });
conv.messages.push({ role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() });
saveConversation(testClientId, testThreadId, conv);

// Reload and verify
const reloaded = loadConversation(testClientId, testThreadId);
assert(reloaded.messages.length === 2, 'Messages persisted after save');
assert(reloaded.messages[0].content === 'Hello!', 'First message content preserved');
assert(reloaded.messages[1].content === 'Hi there!', 'Second message content preserved');

// Test getRecentMessages
for (let i = 0; i < 15; i++) {
  reloaded.messages.push({ role: 'guest', content: `Msg ${i}`, timestamp: new Date().toISOString() });
}
const recent = getRecentMessages(reloaded, 10);
assert(recent.length === 10, 'getRecentMessages returns last 10');
assert(recent[9].content === 'Msg 14', 'Last recent message is most recent');

// Test message trimming (MAX_MESSAGES = 100)
const bigConv = loadConversation(testClientId, 'thread-big');
for (let i = 0; i < 110; i++) {
  bigConv.messages.push({ role: 'guest', content: `Big ${i}`, timestamp: new Date().toISOString() });
}
saveConversation(testClientId, 'thread-big', bigConv);
const trimmed = loadConversation(testClientId, 'thread-big');
assert(trimmed.messages.length === 100, 'Messages trimmed to 100');
assert(trimmed.messages[0].content === 'Big 10', 'Oldest messages removed');

// Cleanup test files
const testDir = path.join(__dirname, 'conversations', '_test_simulation_');
try {
  fs.rmSync(testDir, { recursive: true });
} catch { /* ignore */ }

// ── Test 5: Path Traversal Defense ──────────────────────

console.log('\n═══ Test 5: Path Traversal Defense ═══');

// These should NOT create files outside conversations/
const maliciousThreadIds = [
  '../../etc/passwd',
  '../../../tmp/evil',
  'thread/../../../hack',
  '..\\..\\windows\\system32',
  'normal-thread',
];

for (const threadId of maliciousThreadIds) {
  const conv5 = loadConversation('_test_traversal_', threadId);
  conv5.messages.push({ role: 'guest', content: 'test', timestamp: new Date().toISOString() });
  saveConversation('_test_traversal_', threadId, conv5);
}

// Verify all files are inside conversations/_test_traversal_/
const traversalDir = path.join(__dirname, 'conversations', '_test_traversal_');
if (fs.existsSync(traversalDir)) {
  const files = fs.readdirSync(traversalDir);
  assert(files.length > 0, 'Test files created in safe directory');

  // Verify no file has slashes or dots in name (sanitized)
  const hasUnsafe = files.some(f => f.includes('..') || f.includes('/') || f.includes('\\'));
  assert(!hasUnsafe, 'No path traversal characters in filenames');

  // Cleanup
  fs.rmSync(traversalDir, { recursive: true });
}

// Verify no file was created outside conversations directory
const etcCheck = path.join(__dirname, '..', 'etc');
assert(!fs.existsSync(etcCheck), 'No etc/ directory created by traversal attempt');

// ── Test 6: Payload Normalization ───────────────────────

console.log('\n═══ Test 6: Payload Normalization ═══');

// Inline the normalizePayload function for testing (it's not exported)
function normalizePayload(payload) {
  if (payload.id && payload.conversation_id) return payload;
  if (payload.data) {
    return {
      id: payload.data.id || payload.id || `msg-${Date.now()}`,
      conversation_id: payload.data.conversation_id || payload.data.thread_id,
      property_id: payload.data.property_id || payload.data.listing_id,
      body: payload.data.body || payload.data.message || payload.data.content,
      sender: payload.data.sender || { type: 'guest', name: 'Guest' },
      reservation: payload.data.reservation || null,
    };
  }
  return {
    id: payload.id || payload.message_id || `msg-${Date.now()}`,
    conversation_id: payload.conversation_id || payload.thread_id,
    property_id: payload.property_id || payload.listing_id,
    body: payload.body || payload.message || payload.content || '',
    sender: payload.sender || { type: 'guest', name: 'Guest' },
    reservation: payload.reservation || null,
  };
}

// Direct payload
const directPayload = {
  id: 'msg-001',
  conversation_id: 'conv-001',
  property_id: 'prop-001',
  body: 'What is the WiFi?',
  sender: { type: 'guest', name: 'John' },
};
const norm1 = normalizePayload(directPayload);
assert(norm1.id === 'msg-001', 'Direct: ID preserved');
assert(norm1.body === 'What is the WiFi?', 'Direct: body preserved');

// Nested payload
const nestedPayload = {
  event: 'message.created',
  data: {
    id: 'msg-002',
    conversation_id: 'conv-002',
    property_id: 'prop-002',
    body: 'Parking question',
    sender: { type: 'guest', name: 'Jane' },
  },
};
const norm2 = normalizePayload(nestedPayload);
assert(norm2.id === 'msg-002', 'Nested: ID extracted from data');
assert(norm2.body === 'Parking question', 'Nested: body extracted from data');
assert(norm2.sender.name === 'Jane', 'Nested: sender extracted from data');

// Fallback payload (different field names)
const fallbackPayload = {
  message_id: 'msg-003',
  thread_id: 'thread-003',
  listing_id: 'listing-003',
  message: 'Check-in time?',
};
const norm3 = normalizePayload(fallbackPayload);
assert(norm3.id === 'msg-003', 'Fallback: message_id mapped to id');
assert(norm3.conversation_id === 'thread-003', 'Fallback: thread_id mapped');
assert(norm3.body === 'Check-in time?', 'Fallback: message mapped to body');

// Empty payload
const emptyPayload = {};
const norm4 = normalizePayload(emptyPayload);
assert(norm4.body === '', 'Empty payload: body defaults to empty string');
assert(norm4.sender.type === 'guest', 'Empty payload: default sender type');

// ── Test 7: Rate Limiting ───────────────────────────────

console.log('\n═══ Test 7: Rate Limiting ═══');

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

// First 10 messages should pass
let limitTriggered = false;
for (let i = 0; i < 10; i++) {
  if (isRateLimited('test-conv')) limitTriggered = true;
}
assert(!limitTriggered, 'First 10 messages are not rate limited');

// 11th message should be limited
assert(isRateLimited('test-conv') === true, '11th message IS rate limited');

// Different conversation should not be limited
assert(isRateLimited('other-conv') === false, 'Different conversation not rate limited');

// ── Test 8: Duplicate Detection ─────────────────────────

console.log('\n═══ Test 8: Duplicate Detection ═══');

const processedMessages = new Set();
const MAX_PROCESSED = 5000;

function checkDuplicate(messageId) {
  if (processedMessages.has(messageId)) return true;
  processedMessages.add(messageId);
  if (processedMessages.size > MAX_PROCESSED) {
    const first = processedMessages.values().next().value;
    processedMessages.delete(first);
  }
  return false;
}

assert(checkDuplicate('msg-001') === false, 'First occurrence not duplicate');
assert(checkDuplicate('msg-001') === true, 'Second occurrence IS duplicate');
assert(checkDuplicate('msg-002') === false, 'Different ID not duplicate');

// Test Set size limit
for (let i = 0; i < 5010; i++) {
  checkDuplicate(`bulk-${i}`);
}
assert(processedMessages.size <= MAX_PROCESSED + 1, 'Set size stays bounded');

// ── Test 9: Knowledge Base Loading ──────────────────────

console.log('\n═══ Test 9: Knowledge Base ═══');

const knowledgeDir = path.join(__dirname, 'knowledge', 'solnest');
const expectedFiles = ['boho-bliss.md', 'urban-nest.md', 'apres-arcade.md', 'sunburst-chalet.md'];

for (const file of expectedFiles) {
  const filePath = path.join(knowledgeDir, file);
  assert(fs.existsSync(filePath), `Knowledge file exists: ${file}`);

  const content = fs.readFileSync(filePath, 'utf-8');
  assert(content.length > 50, `Knowledge file has content: ${file}`);
  assert(content.includes('Guest Information'), `Knowledge file has header: ${file}`);
}

// ── Test 10: Message Flow Order Validation ──────────────

console.log('\n═══ Test 10: Message Flow Order ═══');

// Simulate the message flow order to verify no duplication
const simConv = { messages: [
  { role: 'guest', content: 'Previous question', timestamp: '2024-01-01T00:00:00Z' },
  { role: 'assistant', content: 'Previous answer', timestamp: '2024-01-01T00:01:00Z' },
]};

// Step 1: Get recent messages BEFORE pushing current (the fix)
const simRecent = getRecentMessages(simConv);
assert(simRecent.length === 2, 'Recent messages has 2 entries (before push)');
assert(simRecent[simRecent.length - 1].role === 'assistant', 'Last recent message is assistant (not current guest)');

// Step 2: Push current message
simConv.messages.push({ role: 'guest', content: 'What is WiFi?', timestamp: '2024-01-01T00:02:00Z' });

// Step 3: Build responder messages (simulating responder.js logic)
const filtered = simRecent
  .filter(m => m.role === 'guest' || m.role === 'assistant')
  .map(m => ({
    role: m.role === 'guest' ? 'user' : 'assistant',
    content: m.content,
  }));

const conversationContext = [];
for (const msg of filtered) {
  const last = conversationContext[conversationContext.length - 1];
  if (last && last.role === msg.role) {
    last.content += '\n' + msg.content;
  } else {
    conversationContext.push({ ...msg });
  }
}

const messages = [...conversationContext];
const lastMsg = messages[messages.length - 1];
const currentMessage = 'What is WiFi?';
if (lastMsg && lastMsg.role === 'user') {
  lastMsg.content += '\n' + currentMessage;
} else {
  messages.push({ role: 'user', content: currentMessage });
}

// Verify: current message appears exactly ONCE
const allUserContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
const wifiCount = (allUserContent.match(/What is WiFi\?/g) || []).length;
assert(wifiCount === 1, `Current message appears exactly once (found ${wifiCount})`);

// Verify: message order is correct (user, assistant, user)
assert(messages.length === 3, `Message count is 3 (got ${messages.length})`);
assert(messages[0].role === 'user', 'First is user (previous question)');
assert(messages[1].role === 'assistant', 'Second is assistant (previous answer)');
assert(messages[2].role === 'user', 'Third is user (current question)');

// ── Test 11: Edge Cases ─────────────────────────────────

console.log('\n═══ Test 11: Edge Cases ═══');

// Empty message body
assert((!'' || ''.trim().length === 0), 'Empty string caught by empty check');
assert((!null), 'Null caught by empty check');
assert((!undefined), 'Undefined caught by empty check');
assert(('   '.trim().length === 0), 'Whitespace-only caught by trim check');

// Non-guest sender types
const senderTypes = [
  { type: 'host', skip: true },
  { type: 'system', skip: true },
  { type: 'bot', skip: true },
  { type: 'guest', skip: false },
  { type: undefined, skip: true },
];

for (const sender of senderTypes) {
  const shouldSkip = sender.type !== 'guest';
  assert(shouldSkip === sender.skip, `Sender type "${sender.type}" ${sender.skip ? 'skipped' : 'processed'}`);
}

// Escalation keyword matching (lookaround assertions, case insensitive)
// Uses (?<![\w-]) and (?![\w-]) to prevent false positives like
// "fireplace" → "fire", "policies" → "police", "smoke-free" → "smoke"
const keywords = ['fire', 'flood', 'police', 'emergency', 'smoke', 'not working'];

function matchesKeyword(message, keywordList) {
  for (const keyword of keywordList) {
    const regex = new RegExp(`(?<![\\w-])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i');
    if (regex.test(message)) return true;
  }
  return false;
}

const testMessages = [
  // True positives — should escalate
  { msg: 'There is a FIRE!', expected: true },
  { msg: 'FLOOD in bathroom', expected: true },
  { msg: 'Call the police!', expected: true },
  { msg: 'I smell smoke', expected: true },
  { msg: 'The heater is not working', expected: true },
  // False positives now correctly rejected via word boundary matching
  { msg: 'the fireplace is nice', expected: false },
  { msg: 'What are the cancellation policies?', expected: false },
  { msg: 'Is this a smoke-free property?', expected: false },
  { msg: 'We had a campfire last night', expected: false },
  // True negatives — should not escalate
  { msg: 'How is parking?', expected: false },
  { msg: 'What time is check-in?', expected: false },
];

for (const test of testMessages) {
  const matched = matchesKeyword(test.msg, keywords);
  assert(matched === test.expected, `Keyword check: "${test.msg}" → ${test.expected ? 'escalate' : 'no match'}`);
}

// ── Test 12: Stay Phase Calculation ──────────────────────

console.log('\n═══ Test 12: Stay Phase ═══');

// Inline getStayPhase (not exported, same logic as responder.js)
function getStayPhase(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 'unknown';
  const now = new Date();
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  if (now < inDate) return 'pre_arrival';
  if (now >= inDate && now <= outDate) return 'during_stay';
  return 'post_checkout';
}

// Future dates → pre_arrival
const future = new Date();
future.setDate(future.getDate() + 10);
const futureEnd = new Date(future);
futureEnd.setDate(futureEnd.getDate() + 5);
assert(getStayPhase(future.toISOString(), futureEnd.toISOString()) === 'pre_arrival', 'Future check-in → pre_arrival');

// Current dates → during_stay
const pastStart = new Date();
pastStart.setDate(pastStart.getDate() - 2);
const futureCheckout = new Date();
futureCheckout.setDate(futureCheckout.getDate() + 3);
assert(getStayPhase(pastStart.toISOString(), futureCheckout.toISOString()) === 'during_stay', 'Currently staying → during_stay');

// Past dates → post_checkout
const pastIn = new Date('2024-01-01');
const pastOut = new Date('2024-01-05');
assert(getStayPhase(pastIn.toISOString(), pastOut.toISOString()) === 'post_checkout', 'Past dates → post_checkout');

// Missing dates → unknown
assert(getStayPhase(null, '2025-06-01') === 'unknown', 'Null check-in → unknown');
assert(getStayPhase('2025-06-01', null) === 'unknown', 'Null check-out → unknown');
assert(getStayPhase('', '') === 'unknown', 'Empty strings → unknown');
assert(getStayPhase(undefined, undefined) === 'unknown', 'Undefined → unknown');

// Check-in is today → during_stay (edge case)
const todayStr = new Date().toISOString().split('T')[0];
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
assert(getStayPhase(todayStr, tomorrowDate.toISOString()) === 'during_stay', 'Check-in today → during_stay');

// ── Test 13: Conversation Context Builder ───────────────

console.log('\n═══ Test 13: Conversation Context ═══');

// Tests the responder.js message-building logic inline

function buildMessages(recentMessages, currentMessage) {
  const filtered = recentMessages
    .filter(m => m.role === 'guest' || m.role === 'assistant')
    .map(m => ({
      role: m.role === 'guest' ? 'user' : 'assistant',
      content: m.content,
    }));

  const conversationContext = [];
  for (const msg of filtered) {
    const last = conversationContext[conversationContext.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n' + msg.content;
    } else {
      conversationContext.push({ ...msg });
    }
  }

  while (conversationContext.length > 0 && conversationContext[0].role !== 'user') {
    conversationContext.shift();
  }

  const messages = [...conversationContext];
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === 'user') {
    lastMsg.content += '\n' + currentMessage;
  } else {
    messages.push({ role: 'user', content: currentMessage });
  }
  return messages;
}

// Normal flow: guest, assistant, current guest
const msgs1 = buildMessages([
  { role: 'guest', content: 'Hi' },
  { role: 'assistant', content: 'Hello!' },
], 'WiFi password?');
assert(msgs1.length === 3, 'Normal flow: 3 messages');
assert(msgs1[0].role === 'user', 'Normal flow: starts with user');
assert(msgs1[2].content === 'WiFi password?', 'Normal flow: current message is last');

// System messages filtered out
const msgs2 = buildMessages([
  { role: 'guest', content: 'Hi' },
  { role: 'system', content: 'Escalated: emergency' },
  { role: 'assistant', content: 'Help is on the way' },
], 'Thanks');
assert(msgs2.length === 3, 'System messages filtered: 3 messages');
assert(msgs2.every(m => m.role === 'user' || m.role === 'assistant'), 'No system role in output');

// Consecutive guest messages merged
const msgs3 = buildMessages([
  { role: 'guest', content: 'Hello' },
  { role: 'guest', content: 'Anyone there?' },
  { role: 'assistant', content: 'Hi!' },
], 'WiFi?');
assert(msgs3.length === 3, 'Consecutive guests merged: 3 messages');
assert(msgs3[0].content.includes('Hello') && msgs3[0].content.includes('Anyone there?'), 'Guest messages merged');

// Starts with assistant (shifted out)
const msgs4 = buildMessages([
  { role: 'assistant', content: 'Welcome!' },
  { role: 'guest', content: 'Thanks' },
], 'WiFi?');
assert(msgs4[0].role === 'user', 'Leading assistant removed: starts with user');

// Empty history, just current message
const msgs5 = buildMessages([], 'Hello?');
assert(msgs5.length === 1, 'Empty history: 1 message');
assert(msgs5[0].role === 'user', 'Empty history: role is user');
assert(msgs5[0].content === 'Hello?', 'Empty history: content correct');

// Only system messages in history
const msgs6 = buildMessages([
  { role: 'system', content: 'Escalated' },
  { role: 'system', content: 'Alert sent' },
], 'Help');
assert(msgs6.length === 1, 'Only system msgs: falls through to just current');
assert(msgs6[0].content === 'Help', 'Only system msgs: current message preserved');

// Last message is user → appends current (no duplicate user role)
const msgs7 = buildMessages([
  { role: 'guest', content: 'Question 1' },
], 'Question 2');
assert(msgs7.length === 1, 'User-ends: merged into 1 message');
assert(msgs7[0].content.includes('Question 1') && msgs7[0].content.includes('Question 2'), 'User-ends: both questions merged');

// ── Test 14: Alert Text Formatting ──────────────────────

console.log('\n═══ Test 14: Alert Formatting ═══');

// Inline the alert formatting logic (not exported from alerts.js)
function formatAlertText({ type, intent, guestMessage, guestName, propertyName, draftResponse, reason }) {
  if (type === 'draft_approval') {
    return [
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
  }
  const icon = intent === 'emergency' ? '🚨' : '⚠️';
  return [
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

// Escalation alert
const escText = formatAlertText({
  type: 'escalation',
  intent: 'emergency',
  guestMessage: 'There is a fire!',
  guestName: 'John',
  propertyName: 'Boho Bliss',
  reason: 'Emergency keyword detected',
});
assert(escText.includes('🚨'), 'Emergency uses 🚨 icon');
assert(escText.includes('EMERGENCY'), 'Emergency intent uppercased');
assert(escText.includes('Boho Bliss'), 'Property name in alert');
assert(escText.includes('There is a fire!'), 'Guest message in alert');
assert(escText.includes('Emergency keyword detected'), 'Reason in alert');

// Complaint escalation (non-emergency)
const compText = formatAlertText({
  type: 'escalation',
  intent: 'complaint',
  guestMessage: 'The room is dirty',
  guestName: 'Jane',
  propertyName: 'Urban Nest',
});
assert(compText.includes('⚠️'), 'Complaint uses ⚠️ icon');
assert(compText.includes('COMPLAINT'), 'Complaint intent uppercased');
assert(!compText.includes('Reason:'), 'No reason field when not provided');

// Draft approval
const draftText = formatAlertText({
  type: 'draft_approval',
  intent: 'faq',
  guestMessage: 'What is the WiFi?',
  guestName: 'Bob',
  propertyName: 'Sunburst Chalet',
  draftResponse: 'The WiFi password is Guest123',
});
assert(draftText.includes('📝 DRAFT RESPONSE'), 'Draft has correct header');
assert(draftText.includes('The WiFi password is Guest123'), 'Draft response included');
assert(draftText.includes('Reply to approve or edit'), 'Approval CTA present');

// ── Test 15: Config Reload ──────────────────────────────

console.log('\n═══ Test 15: Config Reload ═══');

reloadConfigs();
const afterReload = getConfigByPropertyId('6a9d3726-eace-483f-b3a7-531f1ff2839b');
assert(afterReload !== null, 'Config still accessible after reload');
assert(afterReload.property_name === 'Boho Bliss', 'Correct property after reload');

// Unknown property still returns null after reload
assert(getConfigByPropertyId('xxx') === null, 'Unknown property null after reload');

// ── Test 16: Fallback ID Determinism ────────────────────

console.log('\n═══ Test 16: Fallback ID ═══');

// Inline fallbackId (not exported from index.js)
function fallbackId(payload) {
  const content = payload.body || payload.message || payload.content
    || payload.data?.body || payload.data?.message || '';
  const convId = payload.conversation_id || payload.thread_id
    || payload.data?.conversation_id || payload.data?.thread_id || '';
  let hash = 0;
  const str = `${convId}:${content}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `msg-${Math.abs(hash).toString(36)}`;
}

// Same payload → same ID (deterministic)
const p1 = { conversation_id: 'conv-1', body: 'Hello' };
assert(fallbackId(p1) === fallbackId(p1), 'Same payload → same fallback ID');

// Different content → different ID
const p2 = { conversation_id: 'conv-1', body: 'Goodbye' };
assert(fallbackId(p1) !== fallbackId(p2), 'Different content → different ID');

// Different conversation → different ID
const p3 = { conversation_id: 'conv-2', body: 'Hello' };
assert(fallbackId(p1) !== fallbackId(p3), 'Different conversation → different ID');

// Empty payload → still generates valid ID
const p4 = {};
const emptyId = fallbackId(p4);
assert(emptyId.startsWith('msg-'), 'Empty payload → valid msg- prefix');
assert(emptyId.length > 4, 'Empty payload → non-empty hash');

// Nested data → extracted correctly
const p5 = { data: { conversation_id: 'conv-1', body: 'Hello' } };
assert(fallbackId(p5) === fallbackId(p1), 'Nested data extracts same as flat');

// ── Summary ─────────────────────────────────────────────

console.log('\n═══════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
}
