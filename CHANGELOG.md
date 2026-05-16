# Capital One Shopping Tracker — Changelog

Significant changes to this project, in reverse chronological order.

**How to revert a change:**
- To undo a commit cleanly (creates a new revert commit): `git revert HASH`
- To restore a single file to an earlier state without a revert commit: `git checkout HASH -- public/index.html`
- To see what a commit changed: `git show HASH`

Note: `ingest: refresh offers …` commits are automated — they only update `public/offers.json`. They are not listed here.

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
