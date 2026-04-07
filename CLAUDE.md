\# Solnest AI



\## Active Work

\- Currently working on: Guest Communication AI (guest-agent/) — multi-tenant guest messaging

\- Last decision: Built guest-agent with Express webhook server + Claude classifier/responder

\- Next up: Fill in Solnest property knowledge bases, test with Hospitable webhooks

\- Blockers: None



\## Project Structure

\- guest-agent/ — Guest Communication AI (Express webhook server, multi-tenant)

\- revenue-intel/ — Multi-agent revenue intelligence platform (Node.js + Agent SDK)

\- Revenue Management Agent Project/ — Python revenue engine (12 modules, 164 tests)

\- pricelabs-agent/ — PriceLabs weekly analyzer (production, standalone)

\- recon-researcher/ — YouTube/academic research MCP server (Python)

\- docs/superpowers/ — Architecture specs and phase plans

\- instagram\_output/ — Instagram scraper and analyzer

\- apify\_output/ — Apify scraper output



\## Rules

\- Always use plain JavaScript unless specified otherwise

\- Keep API keys in .env files, never hardcode them



\## Commands

\- Run pricelabs agent: node pricelabs-agent/index.js

\- Start Python revenue engine: cd "Revenue Management Agent Project" && python3 serve.py

\- Run revenue-intel weekly: cd revenue-intel && node orchestrator.js --mode weekly

\- Run revenue-intel daily: cd revenue-intel && node orchestrator.js --mode daily

\- Start revenue-intel scheduler: cd revenue-intel && node index.js

\- Setup PriceLabs auth: cd revenue-intel && node setup-auth.js --site pricelabs

\- Run Python tests: cd "Revenue Management Agent Project" && pytest tests/ -v

\- Start guest agent: cd guest-agent && npm start

\- Guest agent dev mode: cd guest-agent && npm run dev

\- Onboard new client: cd guest-agent && node setup.js --client {name} --hospitable-pat {token}

