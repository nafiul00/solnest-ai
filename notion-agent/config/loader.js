/**
 * Config Loader
 *
 * Loads client configs from config/clients/ directory.
 * Caches by client_id for fast lookup.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateConfig } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENTS_DIR = path.join(__dirname, 'clients');

const configCache = new Map();
let loaded = false;

/**
 * Load all client configs into memory.
 */
export function loadAllConfigs() {
  configCache.clear();

  if (!fs.existsSync(CLIENTS_DIR)) {
    console.warn('[Config] No clients/ directory found');
    return;
  }

  const files = fs.readdirSync(CLIENTS_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(CLIENTS_DIR, file), 'utf-8');
      const config = JSON.parse(raw);
      validateConfig(config);

      // Resolve relative data source paths to absolute
      config._resolved_sources = {
        pricelabs_reports: path.resolve(__dirname, '..', config.data_sources.pricelabs_reports),
        guest_conversations: path.resolve(__dirname, '..', config.data_sources.guest_conversations),
      };

      configCache.set(config.client_id, config);
      console.log(`[Config] Loaded ${config.client_id}: ${config.properties.length} properties`);
    } catch (err) {
      console.error(`[Config] Failed to load ${file}: ${err.message}`);
    }
  }

  loaded = true;
  console.log(`[Config] Total clients loaded: ${configCache.size}`);
}

/**
 * Get config for a specific client.
 */
export function getConfig(clientId) {
  if (!loaded) loadAllConfigs();
  return configCache.get(clientId) || null;
}

/**
 * Get all loaded client configs.
 */
export function getAllConfigs() {
  if (!loaded) loadAllConfigs();
  return Array.from(configCache.values());
}

/**
 * Reload configs.
 */
export function reloadConfigs() {
  loaded = false;
  loadAllConfigs();
}
