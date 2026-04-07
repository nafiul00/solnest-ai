/**
 * Notion API Client — Rate-Limited Wrapper
 *
 * Wraps @notionhq/client with a queue-based rate limiter (3 req/sec).
 * Retries on 429 with exponential backoff.
 */

import { Client } from '@notionhq/client';
import 'dotenv/config';

const MAX_PER_SECOND = 3;
const MAX_RETRIES = 3;
const MAX_BLOCKS_PER_APPEND = 100;

let notionClient = null;

// ── Rate Limiter ────────────────────────────────────────

const queue = [];
let activeRequests = 0;
let lastSecondStart = 0;
let requestsThisSecond = 0;

function getClient() {
  if (!notionClient) {
    const token = process.env.NOTION_TOKEN;
    if (!token) throw new Error('NOTION_TOKEN not set in environment');
    notionClient = new Client({ auth: token });
  }
  return notionClient;
}

function processQueue() {
  if (queue.length === 0) return;

  const now = Date.now();
  if (now - lastSecondStart >= 1000) {
    lastSecondStart = now;
    requestsThisSecond = 0;
  }

  while (queue.length > 0 && requestsThisSecond < MAX_PER_SECOND) {
    const { fn, resolve, reject, retries } = queue.shift();
    requestsThisSecond++;
    activeRequests++;

    fn()
      .then(resolve)
      .catch(err => {
        if (err?.status === 429 && retries < MAX_RETRIES) {
          const delay = Math.pow(2, retries) * 1000;
          console.warn(`[Notion] Rate limited, retrying in ${delay}ms (attempt ${retries + 1}/${MAX_RETRIES})`);
          setTimeout(() => {
            queue.unshift({ fn, resolve, reject, retries: retries + 1 });
            processQueue();
          }, delay);
        } else {
          reject(err);
        }
      })
      .finally(() => {
        activeRequests--;
        // Only schedule next processQueue tick if there are pending items
        if (queue.length > 0) {
          setTimeout(processQueue, 50);
        }
      });
  }

  // If we've hit the limit this second, wait until the next second
  if (queue.length > 0 && requestsThisSecond >= MAX_PER_SECOND) {
    const waitMs = 1000 - (Date.now() - lastSecondStart);
    setTimeout(processQueue, Math.max(waitMs, 50));
  }
}

function rateLimited(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject, retries: 0 });
    processQueue();
  });
}

// ── Database Operations ─────────────────────────────────

/**
 * Query a Notion database with optional filter and sorts.
 */
export async function queryDatabase(databaseId, { filter, sorts, pageSize = 100 } = {}) {
  return rateLimited(() =>
    getClient().databases.query({
      database_id: databaseId,
      ...(filter && { filter }),
      ...(sorts && { sorts }),
      page_size: pageSize,
    })
  );
}

/**
 * Create a page in a Notion database.
 */
export async function createPage(databaseId, properties, children = []) {
  if (children.length > MAX_BLOCKS_PER_APPEND) {
    console.warn(`[Notion] createPage: ${children.length} blocks exceeds ${MAX_BLOCKS_PER_APPEND} limit — overflow will be appended separately.`);
  }
  const initial = children.slice(0, MAX_BLOCKS_PER_APPEND);
  const overflow = children.slice(MAX_BLOCKS_PER_APPEND);

  const page = await rateLimited(() =>
    getClient().pages.create({
      parent: { database_id: databaseId },
      properties,
      ...(initial.length > 0 && { children: initial }),
    })
  );

  // Append remaining blocks in batches
  if (overflow.length > 0) {
    await appendBlocks(page.id, overflow);
  }

  return page;
}

/**
 * Update properties on an existing page.
 */
export async function updatePage(pageId, properties) {
  return rateLimited(() =>
    getClient().pages.update({
      page_id: pageId,
      properties,
    })
  );
}

/**
 * Append blocks to a page. Handles the 100-block limit by batching.
 */
export async function appendBlocks(pageId, blocks) {
  const results = [];
  for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_APPEND) {
    const chunk = blocks.slice(i, i + MAX_BLOCKS_PER_APPEND);
    const result = await rateLimited(() =>
      getClient().blocks.children.append({
        block_id: pageId,
        children: chunk,
      })
    );
    results.push(result);
  }
  return results;
}

// ── Database Creation ───────────────────────────────────

/**
 * Create a Notion database under a parent page.
 */
export async function createDatabase(parentPageId, title, properties) {
  return rateLimited(() =>
    getClient().databases.create({
      parent: { page_id: parentPageId },
      title: [{ type: 'text', text: { content: title } }],
      properties,
    })
  );
}

// ── Health Check ────────────────────────────────────────

/**
 * Verify Notion API connection is working.
 */
export async function healthCheck() {
  try {
    const client = getClient();
    const response = await client.users.me({});
    return { status: 'ok', user: response.name || response.id };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

/**
 * Search for a page by title in the workspace.
 */
export async function searchPages(query) {
  return rateLimited(() =>
    getClient().search({
      query,
      filter: { value: 'page', property: 'object' },
    })
  );
}
