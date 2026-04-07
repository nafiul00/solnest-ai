# Solnest Revenue Intelligence Platform — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Author:** Claude + Ryan

## Problem

The current `pricelabs-agent` is a single-source scraper producing incomplete weekly reports. It misses detailed calendar prices, min/base/max values, competitor analysis, market benchmarks, host analytics, and booking history. The analysis is generic and doesn't follow professional revenue management methodology.

## Goal

Build a multi-agent revenue intelligence system that:
1. Gathers data from 5 sources (PriceLabs, Airbnb public, Airbnb host dashboard, AirDNA, Hospitable API)
2. Applies professional revenue management methodology (from Revenue Manager Training docs)
3. Runs daily quick scans (Slack alerts) and weekly deep analysis (email reports)
4. Discovers and tracks competitor comp sets automatically

## Architecture

6 agents total: 1 orchestrator + 5 data-gathering agents.

| Agent | Source | Method | Data |
|-------|--------|--------|------|
| Orchestrator | All agent outputs | Claude Agent SDK | Coordination + analysis |
| PriceLabs | PriceLabs.co | Playwright | Calendar, prices, min/base/max, neighborhood, customizations |
| Airbnb Competitor | Public Airbnb | Apify actors | Comp rates, calendar, reviews, listing quality |
| Airbnb Insights | Host dashboard | Playwright | Page views, CTR, conversion, ranking |
| AirDNA | AirDNA.co | Playwright | Market ADR, occupancy, RevPAR, seasonality, comp discovery |
| Hospitable | Hospitable API v2 | REST API (PAT) | Bookings, revenue, financials, reviews, calendar |

### Two Operating Modes

- **Daily** (7 AM): Quick scan of next 30 days, flag red flags, post to Slack
- **Weekly** (Monday 8 AM): Full revenue management review, email comprehensive report

## Analysis Methodology

Based on Revenue Manager Training Guide, Training Material, and Training Plan:

### Revenue Flywheel
Visibility (page views, ranking) → Bookings (pace, conversion) → Reviews (score, sentiment) → Ranking → repeat

### Pricing Stack
MIN → Orphan Day (-15-25%) → Last Minute (-10-20%) → BASE → Seasonal → Weekend (+20-40%) → Event (+15-40%) → MAX

### 30-Day Calendar Scan
Flag unbooked gaps, orphan days, pricing vs comps, lead time pricing logic

### Pacing Analysis
Current booked nights vs same period last year. Ahead = hold/raise. Behind = investigate/adjust.

### Red Flag Detection
- 5+ unbooked days within 14 days
- Booked within hours (underpriced)
- Orphan days sitting 7+ days
- Weekdays empty but weekends booked
- Comps booked but you're not
- Comps empty but you're booked

### Comp Set Criteria
From training docs: similar BR count (within 1), similar amenities (hot tub, pool), similar location, similar quality. Must pass: "Would a guest choose this instead?"

## Tech Stack

- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) for multi-agent orchestration
- Playwright for browser-based scraping (PriceLabs, Airbnb Insights, AirDNA)
- Apify API for Airbnb competitor data
- Hospitable REST API v2 with PAT token
- node-cron for scheduling
- nodemailer for email
- Slack webhook for daily alerts
- Plain JavaScript (not TypeScript)
- Zod for MCP tool input schemas

## Project Structure

```
revenue-intel/
  package.json
  .env
  index.js                          # Dual cron scheduler
  orchestrator.js                   # Agent SDK orchestration
  email.js                         # Weekly HTML email
  slack.js                         # Daily Slack alerts
  setup-auth.js                    # Browser auth for 3 sites
  tools/
    pricelabs-tools.js
    airbnb-competitor-tools.js
    airbnb-insights-tools.js
    airdna-tools.js
    hospitable-tools.js
  auth-data/{pricelabs,airbnb,airdna}/
  reports/
  schemas/report-schema.js
```

## Data Flow

1. Cron triggers orchestrator (daily or weekly mode)
2. Orchestrator delegates to 5 sub-agents in parallel
3. Each sub-agent uses its MCP tools to gather data, returns structured JSON
4. Orchestrator merges all data and applies revenue management methodology
5. Generates structured report (daily = summary, weekly = comprehensive)
6. Daily → Slack alert; Weekly → HTML email + saved report

## Properties

| Property | Location | BR | Market |
|----------|----------|-----|--------|
| Boho Bliss | Prince George | 1 | Prince George |
| The Urban Nest | Prince George | 2 | Prince George |
| The Apres Arcade | Sun Peaks | 3 | Sun Peaks |
| The Sunburst Chalet | Sun Peaks | 4 | Sun Peaks |

## Existing Code to Reuse

- `pricelabs-agent/analyze.js` — PriceLabs Playwright scraping patterns
- `pricelabs-agent/email.js` — Nodemailer setup
- `pricelabs-agent/setup-auth.js` — Browser auth session pattern
- `pricelabs-agent/index.js` — Cron + logging pattern
- `solnestai/.env` — APIFY_TOKEN, ANTHROPIC_API_KEY
- `solnestai/apify_trigger.py` — Apify actor IDs (port to JS)

## Success Criteria

1. All 5 agents successfully gather data for all 4 properties
2. Daily Slack alert fires at 7 AM with accurate red flags
3. Weekly email report contains cross-source analysis following revenue management methodology
4. Comp sets discovered and compared via AirDNA
5. Pacing analysis uses actual booking history from Hospitable
6. Flywheel health includes real page view / CTR data from Airbnb Insights
