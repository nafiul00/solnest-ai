/**
 * Guest Communication Log Sync
 *
 * Reads guest-agent conversation JSONs, aggregates stats per thread,
 * and upserts to the Notion Guest Communication Log database.
 *
 * Runs daily at 6 AM (alongside metrics).
 */

import { readConversations, aggregateConversation } from './parsers.js';
import { queryDatabase, createPage, updatePage } from './notion.js';

/**
 * Sync guest communication log for a single client.
 */
export async function syncGuestLog(clientConfig) {
  const conversationsDir = clientConfig._resolved_sources.guest_conversations;
  const dbId = clientConfig.notion_databases.guest_log;

  console.log(`[GuestLog] Syncing ${clientConfig.client_id}`);

  const conversations = readConversations(conversationsDir);

  if (conversations.length === 0) {
    console.log(`[GuestLog] No conversations found`);
    return { synced: 0, errors: 0 };
  }

  let synced = 0;
  let errors = 0;

  for (const conversation of conversations) {
    try {
      const stats = aggregateConversation(conversation);

      // Find property name from thread — conversations are stored in
      // conversations/{client_id}/{thread_id}.json
      // The thread_id is the conversation ID, not directly property-linked.
      // We'll use the client config to set property as "Unknown" unless we can match.
      const propertyName = findPropertyForThread(conversation, clientConfig) || 'Unknown';

      // Check if this thread already exists in Notion
      const existing = await queryDatabase(dbId, {
        filter: {
          property: 'Thread ID',
          title: { equals: stats.thread_id },
        },
      });

      const properties = buildGuestLogProperties(stats, propertyName);

      if (existing.results.length > 0) {
        await updatePage(existing.results[0].id, properties);
      } else {
        await createPage(dbId, properties);
      }

      synced++;
    } catch (err) {
      console.error(`[GuestLog] Failed for thread ${conversation.thread_id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`[GuestLog] Done: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

/**
 * Try to determine which property a conversation belongs to.
 * For now, returns null (property is set at conversation level by guest-agent in the future).
 */
function findPropertyForThread(conversation, clientConfig) {
  // If conversation has property metadata, use it
  if (conversation.property_name) return conversation.property_name;
  if (conversation.property_slug) {
    const prop = clientConfig.properties.find(p => p.slug === conversation.property_slug);
    if (prop) return prop.name;
  }
  return null;
}

/**
 * Build Notion page properties from conversation stats.
 */
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
