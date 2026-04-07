# Solnest AI — Complete Setup & Operations Guide

> Last updated: 2026-03-26

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [ALL TOKENS & API KEYS — Single Reference Page](#all-tokens--api-keys)
3. [Prerequisites & System Setup](#prerequisites)
4. [Before Going Live — Manual Steps](#before-going-live)
5. [Agent 1: Guest Agent (port 3000)](#guest-agent)
6. [Agent 2: Notion Agent (scheduler)](#notion-agent)
7. [Agent 3: PriceLabs Agent (scheduler)](#pricelabs-agent)
8. [Agent 4: Revenue Intel (scheduler)](#revenue-intel)
9. [Python Revenue Engine (port 5050)](#python-revenue-engine)
10. [Daily Operations](#daily-operations)
11. [Bugs Fixed](#bugs-fixed)
12. [Known Limitations & TODOs](#known-limitations)

---

## Project Overview

Solnest AI is a multi-agent automation stack for a 4-property short-term rental portfolio (2x Prince George, 2x Sun Peaks).

```
Guest Messages (Hospitable Webhook)
         ↓
[guest-agent]  →  classify  →  auto-respond / escalate to host
         ↓
[notion-agent] →  sync metrics, reports, conversation logs → Notion

[pricelabs-agent]  →  weekly scrape → AI analysis → email
         ↓
[revenue-intel]    →  multi-source deep analysis → email + Slack
         ↑
[Python Engine]    →  deterministic pricing decisions (164 tests)
```

**Properties:**

| Property | Hospitable UUID | Market |
|---|---|---|
| Boho Bliss | `6a9d3726-eace-483f-b3a7-531f1ff2839b` | Prince George |
| The Urban Nest | `5dc8331d-70a9-4463-bedb-3118a13c103a` | Prince George |
| The Apres Arcade | `9f337b4c-2673-4f67-a9ea-17d0a699c9c2` | Sun Peaks |
| The Sunburst Chalet | `206de053-0f37-4d1c-9955-209b22e3d9c4` | Sun Peaks |

---

## ALL TOKENS & API KEYS

> **Single reference page — copy to a password manager. Never commit to git.**

### Anthropic / Claude

| Variable | Where to get | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys | guest-agent, pricelabs-agent, revenue-intel |
| `CLAUDE_MODEL` | Optional — defaults to `claude-sonnet-4-6` | All agents |

### Hospitable

| Variable | Where to get | Used by |
|---|---|---|
| `HOSPITABLE_PAT` | [developer.hospitable.com](https://developer.hospitable.com) → Personal Access Tokens | guest-agent, revenue-intel |
| `HOSPITABLE_WEBHOOK_SECRET` | Hospitable → Settings → Webhooks → your webhook's signing secret | guest-agent |

### Notion

| Variable | Where to get | Used by |
|---|---|---|
| `NOTION_TOKEN` | [notion.so/my-integrations](https://www.notion.so/my-integrations) → New Integration → copy Internal Integration Token | notion-agent |

### Gmail (email reports & alerts)

| Variable | Where to get | Used by |
|---|---|---|
| `GMAIL_USER` | Your Gmail address | guest-agent, pricelabs-agent, revenue-intel |
| `GMAIL_APP_PASSWORD` | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → 16-char app password (not your real password) | guest-agent, pricelabs-agent, revenue-intel |
| `REPORT_TO_EMAIL` | Where you want reports delivered | pricelabs-agent, revenue-intel |
| `HOST_EMAIL` | Host's email — receives escalation alerts | guest-agent |

### Slack

| Variable | Where to get | Used by |
|---|---|---|
| `SLACK_WEBHOOK_URL` | [api.slack.com/messaging/webhooks](https://api.slack.com/messaging/webhooks) → Create app → Incoming Webhooks → Add to workspace | guest-agent (escalations), revenue-intel (daily alerts) |

### Twilio WhatsApp (optional — only if using WhatsApp escalation alerts)

| Variable | Where to get | Used by |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | [console.twilio.com](https://console.twilio.com) → Account Info | guest-agent |
| `TWILIO_AUTH_TOKEN` | [console.twilio.com](https://console.twilio.com) → Account Info | guest-agent |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp Sandbox or approved number (e.g. `+14155238886`) | guest-agent |
| `HOST_WHATSAPP_NUMBER` | Host's WhatsApp in E.164 format (e.g. `+12505551234`) | guest-agent |

### Apify (competitor scraping)

| Variable | Where to get | Used by |
|---|---|---|
| `APIFY_TOKEN` | [console.apify.com/account/integrations](https://console.apify.com/account/integrations) → Personal API tokens | revenue-intel, apify_trigger.py |

### Internal service config

| Variable | Default | Used by |
|---|---|---|
| `PORT` | `3000` | guest-agent HTTP server |
| `PYTHON_ENGINE_URL` | `http://localhost:5050` | revenue-intel → python bridge |
| `SERVE_PORT` | `5050` | Python revenue engine |
| `PRICELABS_URL` | `https://app.pricelabs.co/pricing` | pricelabs-agent, revenue-intel |
| `DAILY_CRON` | `0 7 * * *` (7 AM daily) | revenue-intel |
| `WEEKLY_CRON` | `0 8 * * 1` (Monday 8 AM) | revenue-intel |

---

## Prerequisites

### System requirements

- **Node.js 18+** — `node --version`
- **Python 3.9+** — `python3 --version`
- **pip3** — `pip3 --version`

### Quickest startup (plug & play)

```bash
# 1. Copy and fill in your API keys (single file for everything)
cp .env.example .env
# edit .env: add ANTHROPIC_API_KEY, GMAIL credentials, etc.

# 2. Start all revenue intelligence services with one command
./start.sh

# 3. Stop everything
./start.sh --stop
```

`start.sh` automatically installs Python and Node.js dependencies, starts the Python revenue engine on port 5050, and starts the revenue-intel scheduler. No manual pip install or npm install needed.

### Manual: Install Playwright browsers

```bash
cd pricelabs-agent && npx playwright install chromium
cd ../revenue-intel && npx playwright install chromium
```

### Manual: Install Python dependencies

```bash
cd "Revenue Management Agent Project"
pip3 install -r requirements.txt
```

### Verify Python tests pass

```bash
cd "Revenue Management Agent Project"
python3 -m pytest
# Expected: 164 passed
```

---

## Before Going Live

Complete these steps **once**, in order, before starting any agents in production.

---

### Step 1 — Fill in property knowledge bases

The guest-agent uses per-property knowledge files to answer guest questions. They currently contain `[FILL IN]` placeholders.

Edit each file and replace every `[FILL IN]` with real info:

```
guest-agent/knowledge/solnest/boho-bliss.md
guest-agent/knowledge/solnest/urban-nest.md
guest-agent/knowledge/solnest/apres-arcade.md
guest-agent/knowledge/solnest/sunburst-chalet.md
```

Each file should contain:

| Section | What to include |
|---|---|
| WiFi | Network name + password |
| Door / lock codes | Front door, lockbox, gate (if applicable) |
| Parking | Where to park, permit required, number of spots |
| Check-in / Check-out | Exact times, early/late policy |
| House rules | Quiet hours, pets, smoking, max guests |
| Heating / cooling | Thermostat location, allowed range |
| Appliances | Washer/dryer, BBQ, hot tub instructions (if applicable) |
| Nearby | 2–3 restaurants, grocery store, hospital, gas station |
| Emergency contacts | Host phone, property manager, local emergency number |
| Check-out instructions | Garbage, dishes, linens |

> Until these files are filled in, the agent will give vague or hallucinated answers to guest questions. This is the most important pre-launch step.

---

### Step 2 — Create Notion databases

The notion-agent needs three Notion databases. Run the setup script once to create them:

```bash
cd notion-agent
npm install
cp .env.example .env
# Edit .env and set NOTION_TOKEN=secret_xxx
node setup.js --client solnest --notion-token secret_xxx
```

The script prints three database IDs. Copy them into `notion-agent/config/clients/solnest.json`:

```json
"notion_databases": {
  "property_performance": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "weekly_reports":       "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "guest_log":            "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Share the integration with your Notion workspace:**

1. Open the Notion page where the databases were created
2. Click **Share** (top right) → **Invite**
3. Search for your integration name → **Invite**

Without this share step, all Notion writes will return 403 errors.

---

### Step 3 — Save PriceLabs browser session

Both `pricelabs-agent` and `revenue-intel` use Playwright to scrape PriceLabs. They need a saved login session.

```bash
# For pricelabs-agent:
cd pricelabs-agent
npm run setup
# Browser opens → log into PriceLabs → dashboard loads → press Ctrl+C
# Session saved to: pricelabs-agent/auth-data/

# For revenue-intel:
cd revenue-intel
node setup-auth.js --site pricelabs
# Same process → session saved to: revenue-intel/auth-data/pricelabs/
```

Sessions last a few months. Redo if you get "auth expired" errors.

---

### Step 4 — Configure the Hospitable webhook

The guest-agent only receives messages if Hospitable is pointed at it.

1. Deploy guest-agent to a public URL (or use ngrok for testing — see below)
2. Go to **Hospitable → Settings → Webhooks → Add webhook**
3. Set:
   - **URL:** `https://your-domain.com/webhook/message`
   - **Event:** `message.created`
4. Copy the displayed **Signing Secret** → paste into `guest-agent/.env` as `HOSPITABLE_WEBHOOK_SECRET`
5. Restart guest-agent

**Testing locally with ngrok:**

```bash
npm install -g ngrok
ngrok http 3000
# Copy the https://xxx.ngrok.io URL → use as webhook URL in Hospitable
```

---

### Step 5 — Fill in Airbnb listing IDs (Phase 3, optional)

Required only if you want Apify competitor scraping in revenue-intel.

Find each listing ID from the Airbnb URL: `airbnb.com/rooms/XXXXXXXXXX`

Edit `revenue-intel/properties.js`:

```js
{ name: 'Boho Bliss',         airbnb_listing_id: '12345678', ... },
{ name: 'The Urban Nest',     airbnb_listing_id: '23456789', ... },
{ name: 'The Apres Arcade',   airbnb_listing_id: '34567890', ... },
{ name: 'The Sunburst Chalet',airbnb_listing_id: '45678901', ... },
```

---

### Step 6 — Save optional auth sessions (Phase 3–4, optional)

```bash
cd revenue-intel

# AirDNA market data (Phase 4):
node setup-auth.js --site airdna
# Browser opens → log into AirDNA → close browser

# Airbnb host dashboard (Phase 3B):
node setup-auth.js --site airbnb
# Browser opens → log into Airbnb → close browser
```

---

### Pre-launch checklist summary

| # | Step | Required? | Done? |
|---|---|---|---|
| 1 | Fill knowledge base `[FILL IN]` placeholders in `guest-agent/knowledge/` | **Yes** | ☐ |
| 2 | Run `notion-agent/setup.js` → paste database IDs into config | **Yes** | ☐ |
| 3 | Save PriceLabs browser sessions (both agents) | **Yes** | ☐ |
| 4 | Point Hospitable webhook → guest-agent URL | **Yes** | ☐ |
| 5 | Add Airbnb listing IDs in `revenue-intel/properties.js` | Phase 3 | ☐ |
| 6 | Save AirDNA / Airbnb auth sessions | Phase 3–4 | ☐ |

---

## Guest Agent

**What it does:** Receives Hospitable webhook messages, classifies guest intent with Claude Haiku, auto-responds or escalates to host via Slack/email/WhatsApp.

**Port:** 3000

### Setup

```bash
cd guest-agent
npm install
cp .env.example .env
```

Edit `.env` — minimum required:

```env
HOSPITABLE_PAT=your_token
HOSPITABLE_WEBHOOK_SECRET=your_secret
ANTHROPIC_API_KEY=sk-ant-...
```

And at least one alert channel:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
# or:
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
HOST_EMAIL=host@example.com
```

### Configure Hospitable webhook

1. Hospitable → Settings → Webhooks → Add webhook
2. URL: `https://your-domain.com/webhook/message`
3. Event: `message.created`
4. Copy the signing secret → `HOSPITABLE_WEBHOOK_SECRET` in `.env`

### Start

```bash
npm start        # Production
npm run dev      # Auto-restart on file changes
```

### Test

```bash
node test-simulation.js
```

### Verify running

```bash
curl http://localhost:3000/health
```

### Fill in property knowledge bases

Edit these files — replace every `[FILL IN]` with real info:

```
guest-agent/knowledge/solnest/boho-bliss.md
guest-agent/knowledge/solnest/urban-nest.md
guest-agent/knowledge/solnest/apres-arcade.md
guest-agent/knowledge/solnest/sunburst-chalet.md
```

Include: WiFi password, door codes, parking instructions, check-in/out times, house rules, nearby restaurants, emergency contacts.

### Response mode

`config/clients/solnest.json`:

- `"response_mode": "auto_send"` — AI sends directly (active default)
- `"response_mode": "draft_approve"` — sends draft to host for approval first

Auto-responds to: `faq`, `pre_arrival`, `checkout`, `booking_inquiry`
Always escalates: `complaint`, `emergency`, `modification`

---

## Notion Agent

**What it does:** Pushes property performance metrics, weekly AI reports, and guest conversation summaries to your Notion workspace.

**Schedule:** Daily at 6 AM, weekly (Monday 7 AM) — America/Vancouver timezone

### Setup

```bash
cd notion-agent
npm install
cp .env.example .env
```

Edit `.env`:

```env
NOTION_TOKEN=secret_xxx
```

### First-time: Create Notion databases

```bash
node setup.js --client solnest --notion-token secret_xxx
```

This creates 3 databases in Notion. Copy the printed database IDs into `config/clients/solnest.json`:

```json
"notion_databases": {
  "property_performance": "paste-id-here",
  "weekly_reports":       "paste-id-here",
  "guest_log":            "paste-id-here"
}
```

**Important:** Share your Notion integration with the parent page:
- Open the Notion page → Share → Invite → find your integration → Invite

### Start

```bash
npm start                     # Scheduled mode
npm run sync                  # Run daily sync now
npm run sync:weekly           # Run daily + weekly sync now
node index.js --run-now       # Same as npm run sync
```

### Data sources

- Reads reports from: `../revenue-intel/reports/*.md`
- Reads guest logs from: `../guest-agent/conversations/solnest/`

Both paths set in `config/clients/solnest.json` → `data_sources`.

---

## PriceLabs Agent

**What it does:** Playwright scrape of PriceLabs dashboard → Claude AI analysis per listing → email report.

**Schedule:** Every Monday at 8 AM (America/Vancouver)

### Setup

```bash
cd pricelabs-agent
npm install
cp .env.example .env
```

Edit `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
REPORT_TO_EMAIL=reports@example.com
```

### First-time: Save PriceLabs login session

```bash
npm run setup
# Browser opens → log in to PriceLabs → wait for dashboard to load → session auto-saved
```

Session saved to `auth-data/` (git-ignored). Redo this if the session expires (every few months).

### Start

```bash
npm start              # Scheduler only (runs Monday 8 AM)
npm run analyze        # Run analysis immediately
node index.js --now    # Same as npm run analyze
```

### Reports

Saved to `reports/report-YYYY-MM-DD.md` and emailed to `REPORT_TO_EMAIL`.

---

## Revenue Intel

**What it does:** Claude Agent SDK orchestrator with 5 MCP data source tools (PriceLabs, Hospitable, Airbnb/Apify, AirDNA, Airbnb Insights). Produces comprehensive weekly reports and daily red-flag alerts.

**Schedule:** Daily 7 AM (quick scan → Slack), Monday 8 AM (deep analysis → email)

### Setup

Revenue Intel reads directly from the top-level `.env` file — no separate `.env` is needed inside `revenue-intel/`.

Minimum required in `S-T-R/Solnest AI/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
REPORT_TO_EMAIL=reports@example.com
```

Optional (each unlocks additional data sources):

```env
HOSPITABLE_PAT=        # Phase 2: booking history, calendar, pacing
APIFY_TOKEN=           # Phase 3: Airbnb competitor scraping
SLACK_WEBHOOK_URL=     # Phase 5: daily Slack alerts
```

### First-time: Save auth sessions

```bash
# PriceLabs (required for base operation):
node setup-auth.js --site pricelabs

# AirDNA (optional, Phase 4):
node setup-auth.js --site airdna

# Airbnb host dashboard (optional, Phase 3B):
node setup-auth.js --site airbnb
```

Each opens a browser → log in → close browser → session saved to `auth-data/{site}/`.

### Start (requires Python engine running first)

**Recommended — single command from project root:**
```bash
./start.sh
```

**Manual — two terminals:**

Terminal A — Python engine:
```bash
cd "Revenue Management Agent Project"
python3 serve.py
```

Terminal B — Revenue intel:
```bash
cd revenue-intel
npm start
```

### Run immediately

```bash
node index.js --mode daily --now     # Quick scan now
node index.js --mode weekly --now    # Full analysis now
```

### Add Airbnb listing IDs (Phase 3)

Edit `properties.js`:

```js
{
  name: 'Boho Bliss',
  airbnb_listing_id: '1234567890',  // from airbnb.com/rooms/1234567890
  ...
}
```

### Reports

Saved to `reports/revenue-intel-{mode}-YYYY-MM-DD.md`
Weekly: emailed to `REPORT_TO_EMAIL`
Daily: sent to `SLACK_WEBHOOK_URL`

---

## Python Revenue Engine

**What it does:** Deterministic pricing decisions — gap/orphan day detection, last-minute discounting, pacing vs last year, event pricing. Called by revenue-intel over HTTP.

**Port:** 5050

### Setup

```bash
cd "Revenue Management Agent Project"
pip install -r requirements.txt
```

### Start

```bash
python3 serve.py
# Starts on http://127.0.0.1:5050

# Custom port:
SERVE_PORT=8080 python3 serve.py
```

### Verify

```bash
curl http://localhost:5050/health
# → {"status":"ok","engine":"revenue-agent-v2"}
```

### Test

```bash
cd "Revenue Management Agent Project"
pytest
# 164 passed — validates all pricing logic
```

---

## Daily Operations

### Typical schedule

| Time | What happens | Agent |
|---|---|---|
| Always on | Respond to guest messages | guest-agent |
| Daily 6 AM | Sync metrics + guest logs to Notion | notion-agent |
| Daily 7 AM | Daily revenue quick scan + Slack alert | revenue-intel |
| Monday 7 AM | Weekly report sync to Notion | notion-agent |
| Monday 8 AM | Weekly pricing report + email | pricelabs-agent |
| Monday 8 AM | Weekly deep analysis + email | revenue-intel |

### Start everything (recommended — single command)

```bash
./start.sh           # Starts Python engine + revenue-intel scheduler
./start.sh --stop    # Stop both
```

### Start everything manually (5 terminals)

```bash
# Terminal 1 — Python Engine
cd "Revenue Management Agent Project" && python3 serve.py

# Terminal 2 — Guest Agent
cd guest-agent && npm start

# Terminal 3 — Notion Agent
cd notion-agent && npm start

# Terminal 4 — Revenue Intel
cd revenue-intel && npm start

# Terminal 5 — PriceLabs Agent
cd pricelabs-agent && npm start
```

### Quick run commands

```bash
# Run revenue intel now:
cd revenue-intel && node index.js --mode weekly --now

# Run pricelabs analysis now:
cd pricelabs-agent && npm run analyze

# Run notion sync now:
cd notion-agent && npm run sync

# Test guest agent:
cd guest-agent && node test-simulation.js

# Python tests:
cd "Revenue Management Agent Project" && pytest
```

### Check guest agent health

```bash
curl http://localhost:3000/health
```

---

## Bugs Fixed

All fixes applied across two audit sessions:

| File | Bug | Fix Applied |
|---|---|---|
| `guest-agent/lib/responder.js` | Hardcoded model `claude-sonnet-4-5-20250929` | Reads `CLAUDE_MODEL` env var, defaults to `claude-sonnet-4-6` |
| `revenue-intel/orchestrator.js` | Default model was `claude-sonnet-4-5-20250929` | Default updated to `claude-sonnet-4-6` |
| `revenue-intel/.env.example` | CLAUDE_MODEL showed old model | Updated to `claude-sonnet-4-6` |
| `guest-agent/.env.example` | Missing `CLAUDE_MODEL` entry | Added with default value |
| `notion-agent/.env.example` | Only 1 line, no documentation | Expanded with setup instructions |
| `.gitignore` | `.env.*` pattern was silently excluding `.env.example` template files from git | Added `!**/.env.example` negation rules |
| `revenue-intel/orchestrator.js` | Agent SDK query produced no text output | Fixed to collect all 3 SDK message formats (text, result, message) |
| `revenue-intel/tools/pricelabs-tools.js` | Silent empty catch on Calendar tab failure | Logs error and stores `calendarError` |
| `revenue-intel/tools/hospitable-tools.js` | No fetch timeout — could hang forever | Added 15s AbortController timeout |
| `guest-agent/lib/hospitable.js` | No fetch timeout | Added 10s AbortController timeout |
| `guest-agent/lib/security.js` | Webhook signature verify always failed | Strips `sha256=` prefix before comparing |
| `guest-agent/index.js` | `property_name` not stored in conversation JSON | Added to conversation metadata |
| `notion-agent/lib/notion.js` | Rate limiter timer leak (setTimeout called after every request) | Only reschedules if queue has pending items |
| `notion-agent/lib/sync-metrics.js` | Date was UTC (wrong in BC timezone) | Uses `toLocaleDateString('en-CA')` |
| `notion-agent/lib/parsers.js` | Timestamp sort bug | Uses `new Date(b) - new Date(a)` comparison |
| `pricelabs-agent/analyze.js` | No per-listing try-catch — one failure aborted all | Each listing wrapped in individual try-catch with dashboard recovery |
| `pricelabs-agent/index.js` | Missing `.catch()` on `--now` run | Added `.catch()` handler |
| `pricelabs-agent/setup-auth.js` | "Done" printed even if login failed | Uses `loginSuccess` flag |
| `Revenue Management Agent Project/serve.py` | Bound to `0.0.0.0` (exposed on all interfaces) | Binds to `127.0.0.1` with `SERVE_HOST` override |
| `Revenue Management Agent Project/serve.py` | Internal error details leaked in response | Generic error message + server-side logging |
| `revenue-intel/index.js` | `import 'dotenv/config'` loaded from CWD — no `.env` in `revenue-intel/` caused FATAL crash on start | Fixed: loads from parent `../` `.env` first, enabling single-file setup |
| `revenue-intel/orchestrator.js` | Same dotenv issue when run directly as CLI | Fixed: same parent-first loading |
| `CLAUDE.md`, `instruction.md` | Commands used `python` instead of `python3` | Fixed: updated to `python3` everywhere |

---

## Known Limitations

### Must complete before going live

- [ ] **Fill in knowledge base files** — `guest-agent/knowledge/solnest/*.md` — replace all `[FILL IN]` with real property info (WiFi passwords, door codes, parking, house rules, check-in/out times)
- [ ] **Run notion-agent setup** — `node setup.js` to create Notion databases, then update `notion-agent/config/clients/solnest.json` with the printed database IDs
- [ ] **Point Hospitable webhook** at your guest-agent server URL with correct signing secret

### Phase 3+ enhancements (optional)

- [ ] Fill `airbnb_listing_id` in `revenue-intel/properties.js` for Apify competitor scraping
- [ ] Run `node revenue-intel/setup-auth.js --site airbnb` for Airbnb Insights
- [ ] Run `node revenue-intel/setup-auth.js --site airdna` for AirDNA market data
- [ ] Verify AirDNA CSS selectors (`tools/airdna-tools.js` — marked `// TODO`)
- [ ] Verify Airbnb Insights CSS selectors (`tools/airbnb-tools.js` — marked `// TODO`)
- [ ] Rotate Apify token if it's been sitting unused

### Architecture notes

- `python-bridge.js:transformToPropertyData()` uses placeholder 30-day calendar data — real booking data flows through once Hospitable Phase 2 is connected and calendar data is pulled per property
- AirDNA and Airbnb Insights Playwright scrapers have working automation but unverified CSS selectors — they fall back to capturing raw `page_text` which Claude can still parse
- `response_mode: "auto_send"` is active — the AI sends messages automatically. Set to `"draft_approve"` in `guest-agent/config/clients/solnest.json` if you want to review drafts first

---

*Solnest AI — fully audited 2026-03-26*
