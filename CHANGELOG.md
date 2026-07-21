# Capital One Shopping Tracker — Changelog

Significant changes to this project, in reverse chronological order.

**How to revert a change:**
- To undo a commit cleanly (creates a new revert commit): `git revert HASH`
- To restore a single file to an earlier state without a revert commit: `git checkout HASH -- public/index.html`
- To see what a commit changed: `git show HASH`

Note: `ingest: refresh offers …` commits are automated — they only update `public/offers.json`. They are not listed here.

**Versioning:** bump `APP_VERSION` in `public/index.html` and `version` in `package.json` together on each meaningful release; the footer shows the version so a cached client is identifiable.

---

## 2026-07-21 — UI: show tomorrow expirations in orange
**Commit:** `020bab6`
**Files:** `public/index.html`, `package.json`, `package-lock.json`
**What changed:** Replaced the broad under-36-hours red treatment with explicit urgency states: offers expiring in under 24 hours remain red, while every offer labeled "expires tomorrow" is orange. Bumped the app/package version to v0.2.3.
**Revert:** `git revert 020bab6`

---

## 2026-07-19 — CI: treat GitHub Pages setup/API failures as warnings
**Commit:** `3f80328`
**Files:** `.github/workflows/ingest.yml`
**What changed:** Extended the Pages-only failure guard beyond `actions/deploy-pages` to cover `actions/configure-pages` and `actions/upload-pages-artifact` too. The 2026-07-19 failure happened before deployment, when `configure-pages` could not read the GitHub Pages site because GitHub returned "No server is currently available to service your request." Ingest had already succeeded, so these Pages API/setup failures now emit a workflow warning and a deduped `pages-deploy-warning` issue without sending a failed-workflow email. Gmail/auth/parser failures still fail the workflow.
**Revert:** `git revert 3f80328`

---

## 2026-07-18 — Docs: dedupe CLAUDE.md/AGENTS.md, retire agent-session coordination
**Commit:** see `git log --grep="agent-session" -1` and the preceding docs commit
**Files:** `CLAUDE.md`, `AGENTS.md`, `HANDOFF.md`, `.claude/settings.json`
**What changed:** Recovered a docs-dedupe commit stranded mid-rebase since 2026-07-03: CLAUDE.md now defers to HANDOFF/AGENTS/README instead of restating them, AGENTS.md's push protocol reflects the hourly (`17 * * * *`) ingest cron, and HANDOFF's snapshot was refreshed (hourly cadence, ~850-line frontend, `APP_VERSION` note). Also removed the `agent-session.js` claim/release protocol from AGENTS.md and its SessionStart/PreToolUse hooks from `.claude/settings.json` — the multi-agent session-locking experiment is retired; `bypassPermissions` remains.
**Revert:** `git revert HASH` (per commit)

---

## 2026-07-02 — CI: reduce routine offer refresh/deploy cadence to hourly
**Commit:** `98d3056`
**Files:** `.github/workflows/ingest.yml`, `sync-worker/wrangler.toml`, `public/index.html`, `package.json`, `package-lock.json`, docs
**What changed:** Routine automatic ingest/deploy runs now fire hourly at minute 17 instead of every 15 minutes, reducing GitHub Pages deploy pressure from about 96 scheduled deploys/day to about 24/day. Updated the Cloudflare Worker cron source, GitHub Actions schedule, stale-feed copy, project docs, and bumped the app/package version to v0.2.2. Manual workflow dispatch and the in-app refresh route are unchanged.
**Revert:** `git revert 98d3056`

---

## 2026-07-02 — CI: downgrade GitHub Pages queue timeouts to warnings
**Commit:** `e193c39`
**Files:** `.github/workflows/ingest.yml`
**What changed:** Pages-only `actions/deploy-pages` queue timeouts no longer fail the whole `Ingest + deploy` workflow. The deploy step now uses `continue-on-error`, emits a workflow warning when GitHub Pages stays queued past the action timeout, and opens a deduped `pages-deploy-warning` issue instead of sending one failed-workflow email every refresh. Ingest/auth/parser failures still fail the workflow and keep the existing `ingest-failure` issue path.
**Revert:** `git revert e193c39`

---

## 2026-06-25 — Fix: never show or open expired offers (client-side expiry gate)
**Commit:** `deef527`
**Files:** `public/index.html`, `package.json`
**What changed:** Expired offers could still render as clickable cards when the served `offers.json` was stale, cached (PWA), or lagging a refresh — the frontend trusted whatever the feed contained and never re-checked expiry against the live clock. Now `filterOffers()` drops any offer past its `expiresAt` in every view (All/Favorites/Hidden) via a new `isExpired()` helper, and `openOffer()` refuses to open a link that is expired as of the click (re-rendering to drop the dead card), covering offers that lapse while their card sits on screen between the 5-minute refreshes. The ingestor/parser were already accurate — C1 emails expire offers at "11:59 PM PDT", which `resolveDate` (day+1 07:00 UTC) matches within a minute — so no parser change was needed. Bumped to v0.2.1. Verified in-browser against a synthetic feed (3 valid shown; 3 expired, incl. a `todays-top`, dropped) and the click guard (valid opens, lapsed does not).
**Revert:** `git revert deef527`

---

## 2026-06-20 — Privacy: redact ingestion email + macOS username from public repo
**Commit:** `b295638`
**Files:** `README.md`, `HANDOFF.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `ingestor/auth.js`
**What changed:** The repo is public, so every tracked file is world-readable. Removed the ingestion inbox address from all docs and the `auth.js` console prompt, and the macOS home path (which leaked the local username) — genericized to `~/` in docs and `$HOME/` in the `.claude/settings.json` hook commands (shell-expanded, so the coordination hooks still resolve). Also pointed the local git author email at the GitHub noreply address so future commits stop leaking the primary email. No runtime impact: ingestion authenticates via the `GMAIL_REFRESH_TOKEN` secret; the PWA, `offers.json`, and sync worker are untouched. Note: the primary email is still in *past* commit metadata — removing that needs a history rewrite + force-push, intentionally not done here.
**Revert:** `git revert b295638` (and `git config user.email <old>` to restore the author email).

---

## 2026-06-20 — Feature: flat-dollar offers ($N back)
**Commit:** `e02c9fa`
**Files:** `ingestor/parser.js`, `ingestor/ingest.js`, `public/index.html`, `README.md`
**What changed:** Offers expressed as a flat dollar amount ("Earn up to $34 back at HelloFresh") are now parsed into a `dollarBack` field (with `percentBack: null`) instead of being dropped. The card renders "$34 back", and dollar offers sort after percentage offers under "Highest %"; merge/sort/hide logic is null-safe. Verified against the real HelloFresh email and a rendered card.
**Revert:** `git revert e02c9fa`

---

## 2026-06-16 — Fix: parse "Earn up to N% back" featured offers
**Commit:** `3cb4f24`
**Files:** `ingestor/parser.js`
**What changed:** Personalized "Offer at <merchant> for you!" emails render their hero offer as "Earn up to N% back at <merchant>"; the "up to" before the percent broke the matcher, so those heroes were silently dropped while same-email digest items parsed fine. Allowed an optional "up to" before the percentage. Recovered 8 offers on the next ingest (19 → 27), including Blue Apron and Wine Insiders. Dollar-amount heroes ("up to $34 back at HelloFresh") remain unhandled — needs non-percent reward rendering in the UI.
**Revert:** `git revert 3cb4f24`

---

## 2026-06-16 — Feature: on-demand refresh button + reliable Cloudflare cron
**Commit:** `a17f635`
**Files:** `public/index.html`, `sync-worker/src/index.js`, `sync-worker/wrangler.toml`, `README.md`, `sync-worker/README.md`, `HANDOFF.md`
**What changed:** Added a minimal header refresh button (instant re-pull of `offers.json`, plus a Gmail-ingest trigger when the Worker is configured). New Worker `POST /refresh` dispatches the GitHub ingest workflow (sync-token gated, 60s KV cooldown); a Cloudflare Cron Trigger (`scheduled()`, `*/15`) fires the same dispatch reliably to replace GitHub's heavily-throttled schedule (real runs were landing every ~1.5–5h, not every 15 min). Inert until `GH_DISPATCH_TOKEN` is set + `wrangler deploy`.
**Revert:** `git revert a17f635`

---

## 2026-06-16 — App: version stamp + bump to v0.2.0
**Commit:** `3c686f8`
**Files:** `public/index.html`, `package.json`
**What changed:** Footer now shows `APP_VERSION` (v0.2.0) so a browser-cached client is identifiable at a glance; `package.json` bumped 0.1.0 → 0.2.0.
**Revert:** `git checkout 3c686f8~1 -- public/index.html package.json`

---

## 2026-06-16 — CI: alert on ingest/deploy failure via GitHub issue
**Commit:** `ac42fa7`
**Files:** `.github/workflows/ingest.yml`
**What changed:** Added a `notify-failure` job that opens (or no-ops on an already-open) `ingest-failure` issue when the scheduled workflow fails, so a dead `GMAIL_REFRESH_TOKEN` or broken cron is visible instead of `offers.json` silently going stale.
**Revert:** `git revert ac42fa7`

---

## 2026-06-14 — Reliability: surface staleness + parse failures; harden ingestor
**Commit:** `00ec219`
**Files:** `public/index.html`, `ingestor/ingest.js`
**What changed:** Staleness banner when `offers.json` is >8h old + an error banner on load failure; `parseFailures` surfaced in the footer. Ingestor now wraps per-message work (one bad message no longer aborts the whole run) and refuses to overwrite `offers.json` when source emails exist but yield 0 offers (exits non-zero so CI flags it).
**Revert:** `git revert 00ec219`

---

## 2026-06-14 — Docs + chore: fix doc drift, backfill hashes, repo hygiene
**Commit:** `652a11f`
**Files:** `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `README.md`, `HANDOFF.md`, `.gitignore`, `LICENSE`, `package.json`, `.claude/launch.json`
**What changed:** Fixed broken `../docs/` doc links, reconciled the auto-push protocol (rebase-first) with HANDOFF, backfilled real commit hashes for the 2026-06-07 entries, refreshed the stale README sync section, ignored `.claude/worktrees/`, removed the duplicate `c1_icon_final.png` + orphan `ingestor/token.json`, added an MIT `LICENSE`.
**Revert:** see commit `652a11f` (per-file).

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
