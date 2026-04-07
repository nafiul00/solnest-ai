/**
 * Client Onboarding Setup Script
 *
 * Pulls property data from Hospitable API and generates:
 * 1. Client config JSON (config/clients/{client_id}.json)
 * 2. Property knowledge base skeletons (knowledge/{client_id}/{slug}.md)
 *
 * Usage:
 *   node setup.js --client solnest --hospitable-pat "pat_xxxxx"
 *   node setup.js --client mountain-view --hospitable-pat "pat_xxxxx"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://public.api.hospitable.com/v2';

// ── Parse CLI Args ──────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--client' && args[i + 1]) parsed.clientId = args[++i];
    if (args[i] === '--hospitable-pat' && args[i + 1]) parsed.pat = args[++i];
    if (args[i] === '--help') {
      console.log('Usage: node setup.js --client <client_id> --hospitable-pat <token>');
      process.exit(0);
    }
  }

  if (!parsed.clientId) { console.error('Error: --client is required'); process.exit(1); }
  if (!parsed.pat) { console.error('Error: --hospitable-pat is required'); process.exit(1); }

  return parsed;
}

// ── Hospitable API ──────────────────────────────────────

async function fetchProperties(pat) {
  const res = await fetch(`${BASE_URL}/properties?per_page=100`, {
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hospitable API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.data || data;
}

// ── Slug Generator ──────────────────────────────────────

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ── Generate Client Config ──────────────────────────────

function generateConfig(clientId, properties) {
  return {
    client_id: clientId,
    client_name: `${clientId.charAt(0).toUpperCase() + clientId.slice(1)} Stays`,
    response_mode: 'auto_send',
    response_tone: 'friendly and professional',
    alert_channels: ['email'],
    escalation_keywords: [
      'fire', 'flood', 'police', 'injury', 'emergency',
      'broken', 'not working', 'dangerous', 'leak', 'smoke',
    ],
    auto_respond_to: ['faq', 'booking_inquiry', 'checkout', 'pre_arrival'],
    escalate_always: ['complaint', 'emergency', 'modification'],
    properties: properties.map(p => ({
      hospitable_id: p.id || p.uuid,
      property_name: p.name || p.title || 'Unnamed Property',
      property_slug: toSlug(p.name || p.title || `property-${p.id}`),
    })),
  };
}

// ── Generate Knowledge Base ─────────────────────────────

function generateKnowledge(property) {
  const name = property.name || property.title || 'Property';
  const address = property.address?.full || property.address?.street || '[FILL IN]';
  const bedrooms = property.bedrooms || '[FILL IN]';
  const bathrooms = property.bathrooms || '[FILL IN]';
  const maxGuests = property.max_guests || property.person_capacity || '[FILL IN]';
  const checkIn = property.check_in_time || property.checkin_time || '[FILL IN]';
  const checkOut = property.check_out_time || property.checkout_time || '[FILL IN]';

  // Extract house rules if available
  const rules = property.house_rules || property.rules || [];
  const rulesText = Array.isArray(rules) && rules.length > 0
    ? rules.map(r => `- ${r}`).join('\n')
    : '- [FILL IN]\n- [FILL IN]';

  // Extract amenities if available
  const amenities = property.amenities || [];
  const amenitiesText = Array.isArray(amenities) && amenities.length > 0
    ? amenities.map(a => typeof a === 'string' ? a : a.name || a.label).join(', ')
    : '[FILL IN]';

  return `# ${name} — Guest Information

## Basic Info
- **Address:** ${address}
- **Bedrooms:** ${bedrooms}
- **Bathrooms:** ${bathrooms}
- **Max Guests:** ${maxGuests}

## Check-In / Check-Out
- **Check-in:** ${checkIn}
- **Check-out:** ${checkOut}
- **Access method:** [FILL IN] (e.g., lockbox, smart lock, key)
- **Door code:** [FILL IN] (sent before arrival)

## WiFi
- **Network:** [FILL IN]
- **Password:** [FILL IN]

## Parking
- [FILL IN] (e.g., free driveway parking for 2 cars, street parking)

## House Rules
${rulesText}

## Amenities
${amenitiesText}

## Kitchen
- [FILL IN] (e.g., fully equipped with stove, microwave, coffee maker)

## Laundry
- [FILL IN] (e.g., washer/dryer in unit, detergent provided)

## Local Recommendations
- **Coffee:** [FILL IN]
- **Groceries:** [FILL IN]
- **Restaurants:** [FILL IN]
- **Attractions:** [FILL IN]

## Troubleshooting
- **WiFi not working:** [FILL IN] (e.g., reboot router in closet)
- **Door code issues:** [FILL IN]
- **Heating/AC:** [FILL IN] (e.g., thermostat location, how to adjust)
- **Anything broken:** [FILL IN] (e.g., text host at phone number)

## Emergency Contacts
- **Host:** [FILL IN name + phone]
- **Emergency:** 911
- **Non-emergency police:** [FILL IN]
- **After-hours maintenance:** [FILL IN]

## Check-out Instructions
1. [FILL IN]
2. [FILL IN]
3. [FILL IN]
4. Lock door and ensure it closes fully

## Special Notes
- [FILL IN any property-specific quirks or important info]
`;
}

// ── Main ────────────────────────────────────────────────

async function main() {
  const { clientId, pat } = parseArgs();

  console.log(`\n🏠 Setting up client: ${clientId}`);
  console.log('   Fetching properties from Hospitable...\n');

  // Fetch properties
  let properties;
  try {
    properties = await fetchProperties(pat);
  } catch (err) {
    console.error(`❌ Failed to fetch properties: ${err.message}`);
    process.exit(1);
  }

  if (!properties || properties.length === 0) {
    console.error('❌ No properties found in Hospitable account');
    process.exit(1);
  }

  console.log(`   Found ${properties.length} properties:\n`);
  for (const p of properties) {
    console.log(`   • ${p.name || p.title || 'Unnamed'} (${p.id || p.uuid})`);
  }

  // Generate and save config
  const config = generateConfig(clientId, properties);
  const configDir = path.join(__dirname, 'config', 'clients');
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, `${clientId}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`\n✅ Config saved: ${configPath}`);

  // Generate and save knowledge bases
  const knowledgeDir = path.join(__dirname, 'knowledge', clientId);
  fs.mkdirSync(knowledgeDir, { recursive: true });

  for (const prop of properties) {
    const slug = toSlug(prop.name || prop.title || `property-${prop.id}`);
    const knowledge = generateKnowledge(prop);
    const knowledgePath = path.join(knowledgeDir, `${slug}.md`);
    fs.writeFileSync(knowledgePath, knowledge, 'utf-8');
    console.log(`✅ Knowledge base: ${knowledgePath}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Setup complete for: ${clientId}
  Properties: ${properties.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
  1. Fill in [FILL IN] sections in knowledge/${clientId}/*.md
  2. Copy .env.example to .env and add your API keys
  3. Set up Hospitable webhook: POST https://your-domain/webhook/message
  4. Start the server: npm start
`);
}

main();
