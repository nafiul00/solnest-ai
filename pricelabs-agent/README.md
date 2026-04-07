# PriceLabs Agent — Solnest Stays

Automated weekly pricing analysis for your Airbnb/STR listings.
Scrapes PriceLabs, analyzes pricing vs market data, and emails you a report every Monday.

## Setup (one-time, on your server)

### 1. Install dependencies

```bash
cd "G:\My Drive\Solnest AI\pricelabs-agent"
npm install
```

### 2. Install Chromium browser for Playwright

```bash
npx playwright install chromium
```

### 3. Configure environment

```bash
copy .env.example .env
```

Edit `.env` with:
- Your **Anthropic API key** from https://console.anthropic.com/
- Your **Gmail address** and **App Password** (not your regular password)
  - Create an App Password at https://myaccount.google.com/apppasswords
- The **email address** to receive reports

### 4. Login to PriceLabs (one-time)

```bash
npm run setup
```

This opens a browser window. Log into PriceLabs manually. Once you see the dashboard, the session is saved automatically. Future runs use this saved session (no manual login needed).

### 5. Test it

```bash
npm run analyze
```

This runs the analysis once and saves a report to `./reports/`. Check that it works before enabling the schedule.

### 6. Start the scheduler

```bash
npm start
```

This keeps running in the background and triggers every Monday at 8 AM Pacific.

To run it as a **Windows service** that survives reboots:

```bash
npm install -g pm2
pm2 start index.js --name pricelabs-agent
pm2 save
pm2 startup
```

## Commands

| Command | What it does |
|---|---|
| `npm start` | Start the weekly scheduler |
| `npm start -- --now` | Start scheduler AND run immediately |
| `npm run analyze` | Run analysis once (no email) |
| `npm run setup` | Login to PriceLabs (saves session) |

## Files

- `index.js` — Scheduler (runs weekly via cron)
- `analyze.js` — Scrapes PriceLabs + generates AI analysis
- `email.js` — Sends report via Gmail
- `setup-auth.js` — One-time login helper
- `auth-data/` — Saved browser session (created by setup)
- `reports/` — Generated reports
- `agent.log` — Activity log

## Re-authentication

If PriceLabs login expires (you'll see errors in agent.log), run `npm run setup` again to re-login.
