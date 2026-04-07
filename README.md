# Solnest AI — Automation Stack

> AI agents and automation tools powering Solnest Stays and the SolnestAI community.
> Built by Ryan Le — Pilot | AI Agent Builder | Entrepreneur.

---

## What's in Here

| Tool | Language | What it does |
|---|---|---|
| [revenue-intel/](#revenue-intel) | Node.js | Multi-agent revenue intelligence — orchestrates data sources via Agent SDK + Python engine |
| [Revenue Management Agent Project/](#revenue-management-agent-project) | Python | Battle-tested revenue engine — 12 modules, 164 tests, pricing decisions |
| [pricelabs-agent/](#pricelabs-agent) | Node.js | Scrapes PriceLabs weekly, generates AI pricing reports, emails them |
| [apify_trigger.py](#airbnb-listing-scraper) | Python | Pulls Airbnb room details + reviews via Apify, merges into a report |
| [instagram_scrape_and_analyze.py](#instagram-analyzer) | Python | Scrapes any IG profile via Apify, runs Claude analysis |
| [content_pipeline_build_guide.md](#content-pipeline) | Guide | Step-by-step build guide: Google Drive → Reap.video → n8n → IG |
| [social_media_growth_plan.md](#social-strategy) | Strategy | Full Instagram + YouTube growth strategy for SolnestAI brand |
| [instagram_week1_action_plan.md](#instagram-week-1) | Action Plan | Detailed Day 1–7 plan: profile cleanup, content, scheduling |
| [Revenue Management Agent Project/](#revenue-management-agent-project) | Training + Calculators | STR revenue management training docs, revenue calculator, daily review template, glossary |
| [.claude/skills/](#claude-code-skills) | Skills | Custom Claude Code skills: pricelabs-analyzer, instagram-analyzer |

---

## Prerequisites

### API Keys Needed

| Service | Used by | Get it at |
|---|---|---|
| Anthropic (Claude) | pricelabs-agent, instagram analyzer | [console.anthropic.com](https://console.anthropic.com/) |
| Apify | apify_trigger.py, instagram_scrape_and_analyze.py | [console.apify.com](https://console.apify.com/) |
| Gmail App Password | pricelabs-agent email sender | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |

### Python Setup

```bash
pip install anthropic requests python-dotenv
```

Or add a `requirements.txt` (recommended):

```
anthropic>=0.52.0
requests>=2.31.0
python-dotenv>=1.0.0
```

### Node.js Setup (for pricelabs-agent)

```bash
cd pricelabs-agent
npm install
# Chromium is installed automatically by npm run setup — no need to run it manually
```

---

## Environment Variables

> **Important:** The Node.js agent and the Python scripts use **two separate `.env` files** in different locations.

### `pricelabs-agent/.env` — used by Node.js agent

Copy `pricelabs-agent/.env.example` to `pricelabs-agent/.env` and fill in:

```env
# Claude / Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Gmail (for email reports)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password-here
REPORT_TO_EMAIL=recipient@gmail.com

# Schedule (cron format — default: Monday 8 AM Pacific)
CRON_SCHEDULE=0 8 * * 1

# PriceLabs URL
PRICELABS_URL=https://app.pricelabs.co/pricing
```

### `.env` (project root) — used by Python scripts

Create `.env` at the project root:

```env
# Apify (for Airbnb + Instagram scrapers)
APIFY_TOKEN=apify_api_...

# Claude / Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

> **Never commit either `.env` to git.** Add both to `.gitignore`. Use `.env.example` files for sharing templates.

---

## pricelabs-agent

Automated weekly pricing analysis for Solnest Stays Airbnb listings.

**Flow:** Playwright scrapes PriceLabs → Claude analyzes pricing vs market data → Email report every Monday 8 AM Pacific.

### First-Time Setup

```bash
cd pricelabs-agent

# 1. Install dependencies
npm install

# 2. Install Playwright browser AND login to PriceLabs (opens browser — log in manually, session saved)
npm run setup

# 3. Test the analysis (no email sent, saves to ./reports/)
npm run analyze

# 4. Start the weekly scheduler
npm start
```

> `npm run setup` installs the Chromium browser and handles login in one step.

### Commands

| Command | What it does |
|---|---|
| `npm start` | Start the weekly scheduler |
| `npm start -- --now` | Start scheduler AND run immediately |
| `npm run analyze` | Run analysis once (no email) |
| `npm run setup` | Login to PriceLabs and save session |

### Running as a Background Service (recommended)

```bash
npm install -g pm2
pm2 start index.js --name pricelabs-agent
pm2 save
pm2 startup
```

Logs are written to `agent.log`. If login expires, re-run `npm run setup`.

### Files

```
pricelabs-agent/
├── index.js          — Scheduler (cron, runs weekly)
├── analyze.js        — Playwright scraper + Claude analysis
├── email.js          — Gmail report sender
├── setup-auth.js     — One-time PriceLabs login helper
├── package.json      — Dependencies and npm scripts
├── README.md         — Subdirectory-specific documentation
├── .env.example      — Environment variable template
├── auth-data/        — Saved browser session (git-ignored)
├── reports/          — Generated .md reports (git-ignored)
└── .env              — Your secrets (git-ignored)
```

---

## Airbnb Listing Scraper

Pulls room details and guest reviews for your Airbnb listings via Apify, then merges them into a structured JSON report.

```bash
python apify_trigger.py
```

### Configuration

Edit the `LISTING_URLS` list in `apify_trigger.py`:

```python
LISTING_URLS = [
    "https://www.airbnb.com/rooms/YOUR_LISTING_ID",
    "https://www.airbnb.com/rooms/ANOTHER_LISTING",
]
```

### Output

Files are saved to `apify_output/` with timestamps:

```
apify_output/
├── rooms_YYYYMMDD_HHMMSS.json    — Raw listing data
├── reviews_YYYYMMDD_HHMMSS.json  — Raw review data
└── report_YYYYMMDD_HHMMSS.json   — Merged: listings + reviews
```

---

## Instagram Analyzer

Scrapes any Instagram profile via Apify and runs a Claude content optimization analysis.

```bash
python instagram_scrape_and_analyze.py <username> [username2] ...

# Examples
python instagram_scrape_and_analyze.py ryan_le5
python instagram_scrape_and_analyze.py ryan_le5 solneststays
```

### Output

Files are saved to `instagram_output/`:

```
instagram_output/
├── <username>_profile.json       — Raw scraped data (latest run)
├── <username>_profile_TIMESTAMP.json — Archived raw data
└── <username>_analysis.md        — Claude's content optimization report
```

The analysis covers:
- Profile overview (followers, engagement rate, bio assessment)
- Top and lowest performing posts (with patterns)
- Content type breakdown (Reels vs images vs carousels)
- Caption and hashtag effectiveness
- Posting schedule analysis
- Specific recommendations: what to archive, double down on, and fix

---

## Claude Code Skills

Two custom skills are installed in `.claude/skills/` for use inside Claude Code sessions in this project:

### `/pricelabs-analyzer`

Launches an interactive Playwright-based session that:
1. Navigates to your PriceLabs dashboard
2. Lists all properties → you pick one
3. Captures calendar data, neighborhood charts, pricing rules
4. Outputs a structured analysis with ranked recommendations
5. Offers to make changes directly in PriceLabs

Requires: Playwright MCP enabled in Claude Code.

### `/instagram-analyzer`

Runs `instagram_scrape_and_analyze.py` for one or more accounts and presents the analysis inline.

Usage: `/instagram-analyzer ryan_le5` or `/instagram-analyzer ryan_le5 solneststays`

---

## Revenue Management Agent Project

> **Goal:** Train human revenue managers and power the AI revenue management agent for Solnest Stays and Better Vacations / RevenueVA clients.

### Training Documents (source .docx files)

| File | Purpose |
|---|---|
| `Revenue Manager Training Guide` | 10-section knowledge reference — pricing strategy, comp sets, listing optimization, KPIs, owner communication |
| `Revenue Manager Training Material` | 6-module hands-on workbook with exercises and visual aids |
| `Revenue Manager Training Plan` | 90-day onboarding program (3 phases: Foundation, Supervised, Independent) |

### Companion Files (generated)

| File | What it contains |
|---|---|
| [`revenue-calculator.md`](Revenue%20Management%20Agent%20Project/revenue-calculator.md) | All revenue formulas: ADR, RevPAR, occupancy, pacing, owner payout, minimum price calculation, annual projections, market benchmarks |
| [`daily-review-template.md`](Revenue%20Management%20Agent%20Project/daily-review-template.md) | Standardised daily 30-day pricing review log — property-by-property, weekly summary, red flag guide |
| [`quick-reference.md`](Revenue%20Management%20Agent%20Project/quick-reference.md) | One-page cheat sheet: daily review steps, pricing priority hierarchy, discount schedule, 5 red flags, core formulas |
| [`glossary.md`](Revenue%20Management%20Agent%20Project/glossary.md) | 25-term STR revenue management glossary: ADR, RevPAR, pacing, comp set, OTA, orphan day, and more |

### Key Revenue Formulas (quick access)

```
ADR     = Total Rental Revenue ÷ Booked Nights
RevPAR  = ADR × Occupancy Rate
Pacing  = (Nights booked for target month today) ÷ (Same month, same date last year) × 100
Min Price = (Fixed Costs/month ÷ Min Expected Nights) + Variable/night) ÷ (1 − Mgmt Fee Rate)
Owner Net = Gross Revenue − Platform Fee − Management Fee − Cleaning − Maintenance
```

### Document Issues Found (2026-03-21 audit — 23 issues)

The training documents contain content gaps and structural errors logged in [IMPROVEMENTS.md](IMPROVEMENTS.md#section-5-revenue-management-agent-project--training-documents):

- **🔴 3 Critical:** Training Plan day numbering is off by 10 throughout Phase 2 & 3 — Days 21–30 of Phase 1 are missing, Phase 2 tables start at Day 21 instead of Day 31, Days 41–50 and 46–50 overlap in Phase 3
- **🟠 6 High:** No multi-channel distribution strategy, no AI agent integration section, no emergency protocols, no owner onboarding checklist, no guest communication templates, no KPI tracking template
- **🟡 9 Medium:** Outdated July 2025 data references, module count mismatch (Guide: 10 vs Workbook: 6), no pricing signal priority hierarchy, no off-season strategy depth, pacing formula ambiguous, and more
- **🔵 5 Low:** No versioning/changelog, listing optimization checklist duplicated across two docs, IntelliHost never assigned in Training Plan, no pricing decision flowchart

---

## Content Pipeline

> Build guide: [`content_pipeline_build_guide.md`](content_pipeline_build_guide.md)

An end-to-end automated content repurposing pipeline:

```
Google Drive (01 - Raw Videos)
    → n8n trigger
        → Reap.video API (AI clip generation with captions)
            → Google Drive (03 - Clips Ready)
                → Slack notification
                    → You move approved clips to (04 - Approved)
                        → n8n trigger
                            → Claude generates caption
                                → Post to Instagram
                                    → Google Drive (05 - Posted)
                                        → Google Sheets log
```

**Stack:** Google Drive · Reap.video · n8n · Claude API · Instagram Graph API (or GHL)

The build guide includes: exact n8n node configs, API curl tests, configuration reference tables, rate limit handling, and end-to-end verification checklist.

---

## Social Strategy

> Full plan: [`social_media_growth_plan.md`](social_media_growth_plan.md)

**Brand identity:** *"I'm a pilot who builds AI agents to run his businesses — and I teach others how to do the same."*

**Platform roles:**
- **Instagram (@ryan_le5)** — brand awareness, content discovery, funnel entry
- **YouTube** — long-form authority, trust-building, Skool conversion
- **Skool (SolnestAI)** — the destination ($67/mo community)

**Funnel:**
```
Instagram/Shorts → YouTube (full walkthrough) → SolnestAI Skool
```

**Posting cadence:** 4x/week Instagram · 1 long-form + 3 Shorts YouTube

### Content Mix
- 40% AI builds & behind-the-scenes
- 30% Pilot/lifestyle crossover (your differentiator)
- 20% Community/social proof
- 10% Lifestyle hooks (yo-yo, wakesurfing, skiing — scroll-stoppers)

---

## Instagram Week 1

> Detailed plan: [`instagram_week1_action_plan.md`](instagram_week1_action_plan.md)

Step-by-step Day 1–7 plan including:
- Post-by-post audit: which 4 posts to archive immediately, rules for the other 74
- Unfollow strategy (2,088 → 500 following, spread over 5 days)
- New bio copy + why it works
- Scripts for all 4 Week 1 posts (reintroduction carousel, "What I Do" Reel, yo-yo hook Reel, "5 AI Agents" carousel)
- Canva template setup
- Scheduling calendar with optimal times
- Daily engagement routine (15 min/day)

---

## Project Structure

```
Solnest AI/
├── pricelabs-agent/          — Node.js weekly pricing analyzer
│   ├── index.js
│   ├── analyze.js
│   ├── email.js
│   ├── setup-auth.js
│   ├── package.json
│   └── .env.example
├── .claude/
│   └── skills/
│       ├── pricelabs-analyzer/SKILL.md
│       └── instagram-analyzer/SKILL.md
├── apify_output/             — Airbnb scrape results (git-ignored)
├── instagram_output/         — Instagram analysis outputs (git-ignored)
├── Revenue Management Agent Project/  — STR revenue manager training + calculators
│   ├── Revenue Manager Training Guide.docx
│   ├── Revenue Manager Training Material.docx
│   ├── Revenue Manager Training Plan.docx
│   ├── revenue-calculator.md    — All revenue formulas + market benchmarks
│   ├── daily-review-template.md — Daily 30-day pricing review log
│   ├── quick-reference.md       — One-page cheat sheet
│   └── glossary.md              — 25-term STR glossary
├── apify_trigger.py          — Airbnb scraper trigger
├── instagram_scrape_and_analyze.py   — Instagram analyzer
├── generate_sop_pdf.py       — SOP PDF generator
├── social_media_growth_plan.md
├── instagram_week1_action_plan.md
├── instagram_week1_post_audit.md
├── content_pipeline_build_guide.md
├── .env                      — Your secrets (git-ignored)
└── README.md
```

---

## Improvements & Known Issues

> Full detailed audit with 42 issues, code references, and fix guidance: **[IMPROVEMENTS.md](IMPROVEMENTS.md)**

A 5-agent parallel code audit (Node.js reviewer, Python reviewer, skills explorer, README accuracy checker, silent failure hunter) was run on 2026-03-19. Top findings:

### 🔴 Fix Before Next Scheduled Run

- [ ] **`reports/` dir never created** — `analyze.js` crashes on first run with ENOENT before saving anything
- [ ] **Empty catch blocks swallow all Calendar + back-button errors** — `analyze.js:108` and `analyze.js:129` silently corrupt data for all listings when navigation fails
- [ ] **Session expiry not detected** — expired auth redirects to login page silently; blank report gets emailed
- [ ] **API token in URL query params** — both Python scripts expose `APIFY_TOKEN` in HTTP logs via `params={"token": ...}`. Use `Authorization: Bearer` header instead
- [ ] **Infinite polling loops** — `while True` in both Python files hangs forever if an Apify run gets stuck
- [ ] **No HTTP timeouts** — every `requests` call can block indefinitely

### 🟠 Do Soon

- [ ] **Add `requirements.txt`** — Python dependencies are undocumented; fresh machine gets `ModuleNotFoundError`
- [ ] **Move `LISTING_URLS` to `.env`** — hardcoded live Airbnb listing URL in source code
- [ ] **Fix Windows-only paths in skills** — `H:/My Drive/Solnest AI` in both SKILL.md files fails on macOS
- [ ] **Remove real API token from `settings.local.json`** — `apify_api_oVQT...` is committed in plaintext
- [ ] **HTML-escape email body** — AI-generated Markdown with `<` `>` characters corrupts the HTML email

### 🟡 Medium

- [ ] **Wrong Claude model ID** — `claude-sonnet-4-20250514` follows old Claude 3.x naming; correct Claude 4 ID is `claude-sonnet-4-5`. Make it a `CLAUDE_MODEL` env var
- [ ] **No `.gitignore`** — `auth-data/`, `reports/`, `apify_output/`, `instagram_output/`, `.env` not excluded
- [ ] **Zero-listing guard missing** — if scrape returns 0 listings (expired auth), blank report gets emailed silently
- [ ] **Missing `user_invocable: true`** in pricelabs-analyzer SKILL.md
- [ ] **Apify actor versioning** — unpinned actor versions can silently break output schema

---

## Stack

| Layer | Technology |
|---|---|
| AI | Claude (Anthropic) via `@anthropic-ai/sdk` and `anthropic` Python package |
| Browser Automation | Playwright (Chromium) |
| Web Scraping | Apify (Airbnb + Instagram actors) |
| Scheduling | node-cron |
| Email | Nodemailer (Gmail SMTP) |
| Workflow Automation | n8n (self-hosted or cloud) |
| Video Clipping | Reap.video API |
| CRM | Airtable |
| Booking | Jobber |
| Community | Skool (SolnestAI) |

---

*Built with Claude Code · SolnestAI Community*
