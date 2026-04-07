/**
 * Multi-Site Auth Setup
 *
 * Opens a browser for manual login and saves the session.
 * Usage:
 *   node setup-auth.js --site pricelabs
 *   node setup-auth.js --site airbnb
 *   node setup-auth.js --site airdna
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITES = {
  pricelabs: {
    url: 'https://app.pricelabs.co/signin',
    waitForUrl: '**/pricing**',
    name: 'PriceLabs',
  },
  airbnb: {
    url: 'https://www.airbnb.com/login',
    waitForUrl: '**/hosting/**',
    name: 'Airbnb',
  },
  airdna: {
    url: 'https://app.airdna.co/login',
    waitForUrl: '**/app/**',
    name: 'AirDNA',
  },
};

async function setupAuth(siteName) {
  const site = SITES[siteName];
  if (!site) {
    console.error(`Unknown site: ${siteName}`);
    console.error(`Available: ${Object.keys(SITES).join(', ')}`);
    process.exit(1);
  }

  const authDir = path.join(__dirname, 'auth-data', siteName);
  console.log(`Opening browser for ${site.name} login...`);
  console.log('Please log in manually. The session will be saved automatically.\n');

  const browser = await chromium.launchPersistentContext(authDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = browser.pages()[0] || await browser.newPage();
  await page.goto(site.url);

  console.log('Waiting for you to log in...');
  console.log('After you see the dashboard, press Ctrl+C to save and exit.\n');

  try {
    await page.waitForURL(site.waitForUrl, { timeout: 300000 });
    console.log(`Login successful! Session saved to ./auth-data/${siteName}/`);
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('Timeout waiting for login. Try running setup again.');
  }

  await browser.close();
  console.log('Done.');
}

// Parse --site argument
const siteArg = process.argv.find((a, i) => process.argv[i - 1] === '--site');
if (!siteArg) {
  console.error('Usage: node setup-auth.js --site <pricelabs|airbnb|airdna>');
  process.exit(1);
}

setupAuth(siteArg).catch(console.error);
