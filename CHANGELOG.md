# Capital One Shopping Tracker — Changelog

Significant changes to this project, in reverse chronological order.

**How to revert a change:**
- To undo a commit cleanly (creates a new revert commit): `git revert HASH`
- To restore a single file to an earlier state without a revert commit: `git checkout HASH -- public/index.html`
- To see what a commit changed: `git show HASH`

Note: `ingest: refresh offers …` commits are automated — they only update `public/offers.json`. They are not listed here.

**Versioning:** bump `APP_VERSION` in `public/index.html` and `version` in `package.json` together on each meaningful release; the footer shows the version so a cached client is identifiable.

---

## 2026-06-16 — Feature: on-demand refresh button + reliable Cloudflare cron
**Commit:** `0faed77`
**Files:** `public/index.html`, `sync-worker/src/index.js`, `sync-worker/wrangler.toml`, `README.md`, `sync-worker/README.md`, `HANDOFF.md`
**What changed:** Added a minimal header refresh button (instant re-pull of `offers.json`, plus a Gmail-ingest trigger when the Worker is configured). New Worker `POST /refresh` dispatches the GitHub ingest workflow (sync-token gated, 60s KV cooldown); a Cloudflare Cron Trigger (`scheduled()`, `*/15`) fires the same dispatch reliably to replace GitHub's heavily-throttled schedule (real runs were landing every ~1.5–5h, not every 15 min). Inert until `GH_DISPATCH_TOKEN` is set + `wrangler deploy`.
**Revert:** `git revert 0faed77`

---

## 2026-06-16 — App: version stamp + bump to v0.2.0
**Commit:** `4192dc4`
**Files:** `public/index.html`, `package.json`
**What changed:** Footer now shows `APP_VERSION` (v0.2.0) so a browser-cached client is identifiable at a glance; `package.json` bumped 0.1.0 → 0.2.0.
**Revert:** `git checkout 4192dc4~1 -- public/index.html package.json`

---

## 2026-06-16 — CI: alert on ingest/deploy failure via GitHub issue
**Commit:** `08de865`
**Files:** `.github/workflows/ingest.yml`
**What changed:** Added a `notify-failure` job that opens (or no-ops on an already-open) `ingest-failure` issue when the scheduled workflow fails, so a dead `GMAIL_REFRESH_TOKEN` or broken cron is visible instead of `offers.json` silently going stale.
**Revert:** `git revert 08de865`

---

## 2026-06-14 — Reliability: surface staleness + parse failures; harden ingestor
**Commit:** `dd4dd54`
**Files:** `public/index.html`, `ingestor/ingest.js`
**What changed:** Staleness banner when `offers.json` is >8h old + an error banner on load failure; `parseFailures` surfaced in the footer. Ingestor now wraps per-message work (one bad message no longer aborts the whole run) and refuses to overwrite `offers.json` when source emails exist but yield 0 offers (exits non-zero so CI flags it).
**Revert:** `git revert dd4dd54`

---

## 2026-06-14 — Docs + chore: fix doc drift, backfill hashes, repo hygiene
**Commit:** `ad8fe56`
**Files:** `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `README.md`, `HANDOFF.md`, `.gitignore`, `LICENSE`, `package.json`, `.claude/launch.json`
**What changed:** Fixed broken `../docs/` doc links, reconciled the auto-push protocol (rebase-first) with HANDOFF, backfilled real commit hashes for the 2026-06-07 entries, refreshed the stale README sync section, ignored `.claude/worktrees/`, removed the duplicate `c1_icon_final.png` + orphan `ingestor/token.json`, added an MIT `LICENSE`.
**Revert:** see commit `ad8fe56` (per-file).

---

## 2026-06-07 — Fix: true cross-device sync (shared token, drop per-device random UUID)
**Commit:** `33da2ac` (+ follow-up `206145d`)
**Files:** `public/index.html`
**What changed:** `bootstrapSyncToken()` no longer mints a per-device
`crypto.randomUUID()` when opened without `?sync=`. Every device now defaults to a
shared token (`SHARED_SYNC_TOKEN`), and since the worker keys state by token
(`state:<token>`), all devices share one KV bucket = real cross-device sync with no
setup. Legacy 8-4-4-4-12 UUID tokens auto-migrate to the shared token on next load,
so existing devices reconverge after one refresh. `?sync=OTHER` still overrides.
Fixes the silent divergence where un-bootstrapped devices showed a green "synced"
dot while writing to private buckets. No worker change needed (worker already
accepts any non-empty token).
**Revert:** `git checkout 33da2ac~1 -- public/index.html` (restores the random-UUID fallback).

---

## 2026-06-07 — Docs: add HANDOFF.md (cross-device / Dispatch handoff front door)
**Commit:** `80e5511`
**Files:** `HANDOFF.md` (new), `CLAUDE.md`, `AGENTS.md`
**What changed:** Added a top-level HANDOFF.md as the start-here doc for any new
session on any device — current state, an environment capability matrix (mobile/
Dispatch vs the owner's Mac), infra/secrets map (locations only, no values),
auto-push protocol, roadmap, and known issues (incl. the cross-device sync
`crypto.randomUUID` divergence). Wired "read HANDOFF.md first" into CLAUDE.md and
AGENTS.md so any new thread is routed to it. Enables spinning up a fully capable
Claude Code thread from Dispatch/mobile.
**Revert:** `git revert 80e5511` (removes HANDOFF.md and the CLAUDE.md / AGENTS.md pointer edits).

---

## 2026-05-16 — Rename project: capone-offers → capone-shopping
**Commit:** `9ead61e`
**Files:** Multiple (repo rename, path updates)
**What changed:** Renamed the project from `capone-offers` to `capone-shopping` throughout. Repo URL and GitHub Pages URL updated accordingly.
**Revert:** `git revert 9ead61e` (or update references manually)

---

## 2026-05-16 — Fix: replace Exclusive badge with inline cap amount
**Commit:** `ce5de8c`
**Files:** `public/index.html`
**What changed:** Removed the "Exclusive" badge from offer cards. Dollar cap amounts for capped-percent offers now appear inline on the percentage line rather than as a separate badge.
**Revert:** `git checkout ce5de8c~1 -- public/index.html`

---

## 2026-05-16 — Sync: always-on via auto-generated UUID token per device
**Commit:** `c0f47da`
**Files:** `public/index.html`
**What changed:** Removed the manual sync opt-in flow. The PWA now auto-generates a UUID token on first load and stores it in `localStorage`. Sync with the Cloudflare Worker is always active — no setup required.
**Revert:** `git checkout c0f47da~1 -- public/index.html`

---

## 2026-05-16 — Fix: parse personalized single-use offers with dollar caps
**Commit:** `7472814`
**Files:** `ingestor/ingest.js`
**What changed:** Ingestor now correctly parses personalized single-use offers that have a dollar cap (e.g., "10% back, up to $25"). Previously these were dropped or misclassified.
**Revert:** `git revert 7472814`

---

## 2026-05-14 — Design: premium app icon — crimson gradient chip with geometric cart
**Commit:** `cdb5463`
**Files:** `public/favicon.svg`, `public/logo.png`, `public/manifest.json`
**What changed:** Replaced the previous favicon/icon with a premium crimson gradient chip design featuring a geometric cart icon. Matches the iPhone app icon quality bar.
**Revert:** `git checkout cdb5463~1 -- public/favicon.svg public/logo.png public/manifest.json`

---

## 2026-05-14 — Docs: comprehensive README covering full architecture and setup
**Commit:** `b4a6f9c`
**Files:** `README.md`
**What changed:** Rewrote the README from scratch to document the full architecture (Gmail → ingestor → GitHub Pages → Cloudflare Worker), repo layout, setup instructions, and how the ingestor and sync worker function.
**Revert:** `git revert b4a6f9c`

---

## 2026-05-11 — Fix: center mobile cards — use minmax(0,1fr) to prevent track overflow
**Commit:** `e51c734`
**Files:** `public/index.html`
**What changed:** Grid column tracks changed from `1fr` to `minmax(0, 1fr)`. On mobile, plain `1fr` allows tracks to overflow the grid container when card content is wide; `minmax(0, 1fr)` enforces the constraint.
**Revert:** `git checkout e51c734~1 -- public/index.html`

---

## 2026-05-11 — Add bypassPermissions for automated Claude task agent
**Commit:** `01205e6`
**Files:** `.claude/settings.json`
**What changed:** Added `bypassPermissions` to the Claude Code project settings so the task-watcher-triggered sessions don't prompt for tool approval.
**Revert:** `git revert 01205e6`

---

## 2026-05-11 — UI: fix logo aspect ratio and enlarge mobile action buttons
**Commit:** `fa65aa7`
**Files:** `public/index.html`
**What changed:** Logo images in offer cards now preserve their aspect ratio. Mobile action buttons (favorite, hide) enlarged to 26px minimum touch target.
**Revert:** `git checkout fa65aa7~1 -- public/index.html`

---

## 2026-05-11 — Mobile: bump breakpoint to 820px, tighter top spacing, safe-area landscape
**Commit:** `bf62d1c`
**Files:** `public/index.html`
**What changed:** Mobile breakpoint increased from a smaller value to 820px. Top spacing tightened. Safe-area-inset respected in landscape orientation for notched iPhones.
**Revert:** `git checkout bf62d1c~1 -- public/index.html`

---

## 2026-05-11 — Frontend: cross-device sync via Cloudflare Worker
**Commit:** `e0098b1`
**Files:** `public/index.html`, `sync-worker/`
**What changed:** First implementation of cross-device sync. Favorites and hidden state are now stored in the Cloudflare Worker KV store, keyed by device UUID. Changes on one device propagate to others on next load.
**Revert:** `git revert e0098b1` (removes sync; reverts frontend and worker source)

---

## 2026-05-11 — Sync-worker: Cloudflare Worker for cross-device state
**Commit:** `2f8b57e`
**Files:** `sync-worker/`
**What changed:** Initial commit of the Cloudflare Worker source. Provides a REST API for reading and writing per-device favorites/hidden state backed by KV storage.
**Revert:** `git revert 2f8b57e`
