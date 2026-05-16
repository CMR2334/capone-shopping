# Capital One Shopping Tracker — AI Assistant Brief

This document is for any AI assistant working in this directory. It is AI-agnostic — the same instructions apply whether you are Claude, Codex, Gemini, Cursor, or any other assistant.

See [../USER_PROFILE.md](../USER_PROFILE.md) for the workspace owner's working style and communication preferences.
See [../PREFERENCES.md](../PREFERENCES.md) for code and documentation standards.

---

## What This Project Is

A PWA that tracks Capital One Shopping cashback offers. It ingests offer emails from Gmail, parses them into structured data, and surfaces them in a clean mobile-first card UI with cross-device sync.

- **Live URL:** https://CMR2334.github.io/capone-shopping/
- **Repo:** https://github.com/CMR2334/capone-shopping
- **Local path:** `/Users/collinrekowski/Automation/capone-shopping/`
- **Source inbox:** cmreko91@gmail.com (Capital One Shopping emails from hello@capitaloneshopping.com)

---

## Architecture

```
Gmail inbox (cmreko91@gmail.com)
    └── ingestor/ingest.js       (GitHub Actions, every 15 min)
            └── public/offers.json   (committed to main, served by GitHub Pages)
                    └── public/index.html    (PWA fetches & renders)
                            └── sync-worker      (Cloudflare Worker, favorites/hidden state)
```

**Frontend:** Single-file PWA in `public/index.html` — all HTML, CSS, and JS in one file. Vanilla JS+CSS, no build step.

**Ingestor:** `ingestor/ingest.js` runs on a GitHub Actions cron every 15 minutes. It reads the last 30 days of Capital One Shopping emails, parses offer data, and commits an updated `public/offers.json` to `main` if anything changed. The deploy job publishes `public/` to GitHub Pages immediately after.

**Sync backend:** Cloudflare Worker stores per-device favorites/hidden state. Keyed by a UUID token auto-generated on first PWA load and persisted in `localStorage`. No login required — the token is the identity.

**Key files:**
- `public/index.html` — entire frontend app
- `public/offers.json` — parsed offer data (auto-committed by ingestor)
- `ingestor/ingest.js` — Gmail ingestion and parsing logic
- `sync-worker/` — Cloudflare Worker source
- `.github/workflows/` — GitHub Actions cron and deploy configuration

---

## Key UI Notes

These are known fixes that must be preserved when editing the frontend:

- **Grid columns:** Use `minmax(0, 1fr)` not `1fr` for offer card grid tracks. Plain `1fr` causes track overflow on mobile — cards bleed outside the viewport.
- **Logo alignment:** Logo images in offer cards use `align-self: flex-start` to prevent stretching when the adjacent text is taller.
- **Mobile buttons:** Action buttons (favorite, hide) are 26px minimum touch target on mobile.

---

## Auto-Push Protocol

Always commit and push after making changes to the frontend. The live URL rebuilds automatically within 30–90 seconds.

```bash
cd /Users/collinrekowski/Automation/capone-shopping && \
  git add public/index.html && \
  git commit -m "auto update" && \
  git push origin main
```

Do not manually commit `public/offers.json` — the ingestor manages that file via GitHub Actions.

---

## Session Protocol

1. Check `CHANGELOG.md` for recent significant changes before starting work.
2. Do the work.
3. Commit and push.
4. Add an entry to `CHANGELOG.md` if the change is significant (UI changes, logic changes, new features, bug fixes).
