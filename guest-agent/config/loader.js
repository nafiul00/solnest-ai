import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateConfig } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENTS_DIR = path.join(__dirname, 'clients');

// In-memory cache: hospitable_id → merged config
const configCache = new Map();
let loaded = false;

/**
 * Load all client configs into memory at startup.
 * Maps every hospitable property_id to its client + property config.
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

      for (const property of config.properties) {
        configCache.set(property.hospitable_id, {
          client_id: config.client_id,
          client_name: config.client_name,
          response_mode: config.response_mode,
          response_tone: config.response_tone || 'friendly and professional',
          alert_channels: config.alert_channels,
          escalation_keywords: config.escalation_keywords || [],
          auto_respond_to: config.auto_respond_to,
          escalate_always: config.escalate_always,
          // Property-specific fields
          hospitable_id: property.hospitable_id,
          property_name: property.property_name,
          property_slug: property.property_slug,
        });
      }

      console.log(`[Config] Loaded ${config.client_id}: ${config.properties.length} properties`);
    } catch (err) {
      console.error(`[Config] Failed to load ${file}: ${err.message}`);
    }
  }

  loaded = true;
  console.log(`[Config] Total properties mapped: ${configCache.size}`);
}

/**
 * Get client config for a specific hospitable property ID.
 * Returns null if no matching config found.
 */
export function getConfigByPropertyId(propertyId) {
  if (!loaded) loadAllConfigs();
  return configCache.get(propertyId) || null;
}

/**
 * Reload configs (e.g., after adding a new client).
 */
export function reloadConfigs() {
  loaded = false;
  loadAllConfigs();
}
