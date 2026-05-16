# Capital One Shopping Tracker — Claude Code Instructions

## Pre-Approved Access
Collin pre-approves all Bash, Read, Edit, Write, and computer-use actions for:
- All paths under /Users/collinrekowski/Automation/
- ~/Library/LaunchAgents/
- /tmp/
No need to request confirmation for these locations in any session.
See ../USER_PROFILE.md for full working preferences.

## Read first
Check [CHANGELOG.md](CHANGELOG.md) at the start of every session for recent significant changes.

## Auto-push protocol (apply in every session)
Always commit and push after making frontend changes. GitHub Pages rebuilds within 30–90s.

```bash
cd /Users/collinrekowski/Automation/capone-shopping && \
  git add public/index.html && \
  git commit -m "auto update" && \
  git push origin main
```

Do **not** manually commit `public/offers.json` — the GitHub Actions ingestor manages that file.

Push at least every 30 minutes of active work. Push before the user steps away.

Live URL: `https://CMR2334.github.io/capone-shopping/` (rebuilt automatically by GitHub Pages within 30–90s of every push to `main`).

## Project
Single-file PWA that tracks Capital One Shopping cashback offers. Frontend lives in `public/index.html` (vanilla JS + CSS, no build step). Offers are ingested from Gmail by a GitHub Actions cron and committed as `public/offers.json`.

## Permissions
This project runs with `bypassPermissions` mode — all tool calls (Bash, Read, Edit, Write, etc.) are auto-approved without prompting. Configured in `.claude/settings.json`.

## Architecture
See [AGENTS.md](AGENTS.md) for full architecture notes (AI-agnostic version of this file).

## Key File Locations
- `public/index.html` — entire frontend app
- `public/offers.json` — parsed offer data (auto-committed by GitHub Actions ingestor)
- `public/favicon.svg`, `public/logo.png` — app icon assets
- `ingestor/ingest.js` — Gmail ingestion and parsing logic
- `sync-worker/` — Cloudflare Worker source (cross-device sync backend)
- `.github/workflows/` — GitHub Actions cron and deploy config

## Key UI Constraints
- Grid columns: `minmax(0, 1fr)` — never plain `1fr` (causes card overflow on mobile)
- Logo images: `align-self: flex-start` (prevents stretch when adjacent text is taller)
- Mobile action buttons: 26px minimum touch target

## Repo
- Repo: https://github.com/CMR2334/capone-shopping
- Live URL: https://CMR2334.github.io/capone-shopping/

## Shared Documentation
- User profile and preferences: /Users/collinrekowski/Automation/USER_PROFILE.md
- Workflow preferences: /Users/collinrekowski/Automation/PREFERENCES.md
- Automation workspace overview: /Users/collinrekowski/Automation/CONTEXT.md
