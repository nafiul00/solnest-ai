/**
 * Client config validation.
 * Validates the JSON config structure for a client before loading.
 */

const VALID_RESPONSE_MODES = ['auto_send', 'draft_approve'];
const VALID_ALERT_CHANNELS = ['slack', 'whatsapp', 'email'];
const VALID_INTENTS = [
  'faq', 'booking_inquiry', 'complaint', 'emergency',
  'modification', 'checkout', 'pre_arrival', 'spam'
];

export function validateConfig(config) {
  const errors = [];

  if (!config.client_id || typeof config.client_id !== 'string') {
    errors.push('client_id is required (string)');
  }

  if (!config.client_name || typeof config.client_name !== 'string') {
    errors.push('client_name is required (string)');
  }

  if (!VALID_RESPONSE_MODES.includes(config.response_mode)) {
    errors.push(`response_mode must be one of: ${VALID_RESPONSE_MODES.join(', ')}`);
  }

  if (!Array.isArray(config.alert_channels)) {
    errors.push('alert_channels must be an array');
  } else {
    for (const ch of config.alert_channels) {
      if (!VALID_ALERT_CHANNELS.includes(ch)) {
        errors.push(`Invalid alert channel: ${ch}. Valid: ${VALID_ALERT_CHANNELS.join(', ')}`);
      }
    }
  }

  if (!Array.isArray(config.properties) || config.properties.length === 0) {
    errors.push('properties must be a non-empty array');
  } else {
    for (const prop of config.properties) {
      if (!prop.hospitable_id) errors.push(`Property missing hospitable_id: ${prop.property_name || 'unknown'}`);
      if (!prop.property_name) errors.push('Property missing property_name');
      if (!prop.property_slug) errors.push(`Property missing property_slug: ${prop.property_name || 'unknown'}`);
    }
  }

  if (!Array.isArray(config.auto_respond_to)) {
    errors.push('auto_respond_to must be an array');
  }

  if (!Array.isArray(config.escalate_always)) {
    errors.push('escalate_always must be an array');
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  return true;
}
