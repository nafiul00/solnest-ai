/**
 * Client Config Schema Validation
 *
 * Validates notion-agent client configuration files.
 */

const REQUIRED_FIELDS = ['client_id', 'client_name', 'notion_databases', 'data_sources', 'properties'];
const REQUIRED_DATABASES = ['property_performance', 'weekly_reports', 'guest_log'];
const REQUIRED_DATA_SOURCES = ['pricelabs_reports', 'guest_conversations'];

// Notion database IDs are UUIDs (with or without dashes)
const NOTION_ID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export function validateConfig(config) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!config[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (config.notion_databases) {
    for (const db of REQUIRED_DATABASES) {
      if (!config.notion_databases[db]) {
        errors.push(`Missing notion_databases.${db}`);
      } else if (!NOTION_ID_RE.test(config.notion_databases[db])) {
        errors.push(`notion_databases.${db} is not a valid Notion database ID (expected UUID, got "${config.notion_databases[db]}")`);
      }
    }
  }

  if (config.data_sources) {
    for (const src of REQUIRED_DATA_SOURCES) {
      if (!config.data_sources[src]) {
        errors.push(`Missing data_sources.${src}`);
      }
    }
  }

  if (config.properties && !Array.isArray(config.properties)) {
    errors.push('properties must be an array');
  }

  if (config.properties && Array.isArray(config.properties)) {
    for (let i = 0; i < config.properties.length; i++) {
      const prop = config.properties[i];
      if (!prop.slug) errors.push(`properties[${i}] missing slug`);
      if (!prop.name) errors.push(`properties[${i}] missing name`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  return true;
}
