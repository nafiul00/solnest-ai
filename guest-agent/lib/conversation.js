/**
 * Conversation History Storage
 *
 * Stores conversation threads as JSON files.
 * Path: conversations/{client_id}/{thread_id}.json
 *
 * Each conversation stores up to 100 messages for context.
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_DIR = path.join(__dirname, '..', 'conversations');
const MAX_MESSAGES = 100;

/**
 * Sanitize path component to prevent directory traversal.
 * Only allows alphanumeric, dash, underscore, and dots (no slashes, no ..).
 */
function sanitizePathComponent(input) {
  if (!input || typeof input !== 'string') return 'unknown';
  const sanitized = input.replace(/[^a-zA-Z0-9\-_]/g, '_');
  if (!sanitized || sanitized === '.' || sanitized === '..') return 'unknown';
  return sanitized;
}

/**
 * Load conversation history for a thread.
 * Returns empty conversation if none exists.
 */
export function loadConversation(clientId, threadId) {
  const filePath = getPath(sanitizePathComponent(clientId), sanitizePathComponent(threadId));

  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`[Conversation] Failed to load ${filePath}: ${err.message}`);
  }

  return {
    thread_id: threadId,
    client_id: clientId,
    messages: [],
    created_at: new Date().toISOString(),
  };
}

/**
 * Save conversation, trimming to last MAX_MESSAGES.
 */
export function saveConversation(clientId, threadId, conversation) {
  const safeClientId = sanitizePathComponent(clientId);
  const safeThreadId = sanitizePathComponent(threadId);
  const dirPath = path.join(CONVERSATIONS_DIR, safeClientId);
  fs.mkdirSync(dirPath, { recursive: true });

  // Trim old messages
  if (conversation.messages.length > MAX_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_MESSAGES);
  }

  conversation.updated_at = new Date().toISOString();

  const filePath = getPath(safeClientId, safeThreadId);
  const data = JSON.stringify(conversation, null, 2);

  // Atomic write: write to temp file then rename to prevent corruption
  // from concurrent webhook requests for the same conversation
  const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, data, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Get recent messages for Claude context window (last N).
 */
export function getRecentMessages(conversation, count = 10) {
  return conversation.messages.slice(-count);
}

function getPath(clientId, threadId) {
  return path.join(CONVERSATIONS_DIR, clientId, `${threadId}.json`);
}
