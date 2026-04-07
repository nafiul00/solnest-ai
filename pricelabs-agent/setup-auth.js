/**
 * PriceLabs Auth Setup
 *
 * Run this once to log into PriceLabs and save the session.
 * The session is stored in ./auth-data/ so future runs don't need manual login.
 *
 * Usage: node setup-auth.js
 */

const { chromium } = require('playwright');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'auth-data');

async function setupAuth() {
  console.log('Opening browser for PriceLabs login...');
  console.log('Please log in manually. The session will be saved automatically.');
  console.log('');

  const browser = await chromium.launchPersistentContext(AUTH_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 }
  });

  const page = browser.pages()[0] || await browser.newPage();
  await page.goto('https://app.pricelabs.co/signin');

  console.log('Waiting for you to log in...');
  console.log('After you see the dashboard, press Ctrl+C to save and exit.');

  // Wait for navigation to the pricing dashboard (means login succeeded)
  let loginSuccess = false;
  try {
    await page.waitForURL('**/pricing**', { timeout: 300000 }); // 5 min timeout
    loginSuccess = true;
    console.log('');
    console.log('Login successful! Session saved to ./auth-data/');
    console.log('The agent will use this session for future automated runs.');

    // Wait a bit to ensure cookies are fully saved
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('');
    console.log('Login not detected — either timed out or login failed.');
    console.log('Try running: npm run setup');
  }

  await browser.close();

  if (loginSuccess) {
    console.log('Done. You can now run: npm start');
  } else {
    console.log('Setup incomplete — run npm run setup again and complete login within 5 minutes.');
    process.exit(1);
  }
}

setupAuth().catch(console.error);
