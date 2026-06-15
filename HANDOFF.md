# HANDOFF — start here (any new session, especially mobile / Dispatch)

This is the front door for any AI session picking up **capone-shopping**, on any
device. It exists so a brand-new thread — desktop *or* a mobile Dispatch thread —
can reach full working context without inheriting a conversation. A new Claude
Code session inherits the **repo**, not the chat history; this file + the docs it
points to *are* the context transfer.

> **If you are a fresh session: read this whole file, then summarize the current
> state, environment limits, and open issues back to the user before doing any
> work.**

---

## Reading order

1. **HANDOFF.md** (this file) — current state, environment limits, roadmap, open issues.
2. **CLAUDE.md** — Claude-specific working rules for this repo.
3. **AGENTS.md** — AI-agnostic architecture brief (same content, any assistant).
4. **README.md** — deep reference: ingestor, parser, worker, endpoints, setup.
5. **CHANGELOG.md** — granular per-commit history (reverse chronological).

HANDOFF = orientation + state. CHANGELOG = the commit-level ledger. Keep both current.

---

## Project snapshot (as of 2026-06-07)

A PWA that tracks Capital One Shopping cashback offers: it ingests offer emails
from Gmail, parses them to structured data, and shows them in a mobile-first card
UI with favorite / hide / sort / filter and (intended) cross-device sync.

- **Live:** https://CMR2334.github.io/capone-shopping/
- **Repo:** https://github.com/CMR2334/capone-shopping  (public)
- **Also known as:** "C1S Email Tracker" — Collin's display label for this project in
  Claude Code. Same project; the repo and local directory stay `capone-shopping`. The
  label is cosmetic and does not affect files or sync.
- **Source inbox:** `cmreko91@gmail.com` — sender filter `hello@capitaloneshopping.com`
- **Status:** Live and healthy. GitHub Actions cron (ingest + Pages deploy) runs
  every 15 min and has been green through today. The frontend (`public/index.html`,
  ~700 lines, single file, no build step) is the bulk of ongoing work.

> **Naming note:** the repo was renamed `capone-offers` → `capone-shopping` on
> 2026-05-16. GitHub redirects the old clone URL, so `git clone …/capone-offers.git`
> still works, but the canonical name and live URL are `capone-shopping`.
> **The Cloudflare Worker kept its original name** — `capone-offers-sync.cmr2334.workers.dev`.
> `public/index.html` points at that URL. Do **not** "fix" the worker name to match
> the repo, or you'll break the live frontend's sync calls.

---

## Architecture (brief — see README/AGENTS for depth)

```
Gmail (cmreko91@gmail.com)
  └─ ingestor/ingest.js + parser.js   (GitHub Actions cron, every 15 min)
        └─ public/offers.json          (committed to main by the bot)
              └─ public/index.html      (PWA: fetch + render, 5-min poll)
                    └─ sync-worker       (Cloudflare Worker, KV-backed fav/hidden)
```

- **Frontend:** `public/index.html` — all HTML/CSS/JS in one file. Vanilla, no bundler.
- **Ingestor:** Node, runs in CI. Reads 30 days of mail, parses, merges by merchant
  (latest expiry wins; ties → higher %), drops expired, writes `public/offers.json`.
- **Sync worker:** Cloudflare Worker + KV (`OFFERS_KV`, id `84ae9a9ba9c944b0848d4c976152ded5`).
  REST: `GET/PUT /state` (Bearer token), `GET /action` (email links), `GET /health`.

---

## Environment capability matrix — READ THIS before promising work on mobile

What a session can do depends on **where it runs**, because the secrets live in two
places only: GitHub Actions secrets (cloud) and the owner's Mac (`token.json`,
`client_secret.json`, `wrangler login`). Those local files are **gitignored**, so a
fresh clone (which is exactly what a Dispatch/cloud session gets) does **not** have them.

| Task | Mobile / Dispatch (fresh clone, no local secrets) | Desktop on Collin's Mac |
|---|---|---|
| Edit `public/index.html` & all frontend, commit, push → live in 30–90s | ✅ Fully | ✅ |
| Edit docs (this file, README, etc.), commit, push | ✅ | ✅ |
| Edit `ingestor/*` or `sync-worker/*` **source**, commit, push | ✅ (code only) | ✅ |
| Run the ingestor and see parsed output | ⚠️ Not directly — needs `token.json`/`client_secret.json` or the 3 Gmail env vars. **Workaround: push the change; GitHub Actions runs the ingestor with secrets already configured, then commits `offers.json`.** | ✅ `npm run ingest` |
| Iterate on the parser against real emails | ⚠️ Limited — raw HTML (`ingestor/raw/`) is gitignored, so no fixtures in a fresh clone. Best done on the Mac, or commit a redacted fixture first. | ✅ `SAVE_RAW=1 npm run ingest` |
| Deploy the Cloudflare Worker (`wrangler deploy`) | ⚠️ Needs Cloudflare auth. **Workaround:** Collin runs it on the Mac, OR add a `CLOUDFLARE_API_TOKEN` repo secret + a deploy workflow (see Roadmap) to make worker deploys CI-driven and fully mobile-capable. | ✅ |
| Re-run Gmail OAuth (`npm run auth`) | ❌ Interactive browser + local file write. | ✅ |

**Bottom line for mobile:** ~90% of day-to-day work (all UI/UX, layout, sort/filter,
copy, icon, docs) is fully doable from Dispatch — edit, push, auto-deploy. The only
things that truly need the Mac are *running* the ingestor/parser against live Gmail
and *deploying* the worker — and both have CI workarounds noted above.

---

## Infrastructure & secrets map (locations only — NO secret values; repo is public)

| Thing | Where it lives | Notes |
|---|---|---|
| Gmail read access | GitHub Actions secrets: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Powers the CI ingestor. Already configured. |
| Local Gmail creds | Mac only: `client_secret.json`, `token.json` (gitignored) | For local `npm run ingest` / `npm run auth`. |
| Worker auth secret | Cloudflare: secret `SYNC_TOKEN` on the worker | Gates `/state` and `/action`. Never commit it. |
| KV store | Cloudflare KV `OFFERS_KV` = `84ae9a9ba9c944b0848d4c976152ded5` | Just an id, not a secret. |
| Accounts | Gmail being read: `cmreko91@gmail.com`. The Google Cloud project + Cloudflare account are owned by a **separate** Google account. | Ask Collin for the owner account if you need console/Cloudflare access; it's intentionally not written here. |

To rotate the Gmail refresh token: revoke at myaccount.google.com/permissions →
`npm run auth` on the Mac → update the `GMAIL_REFRESH_TOKEN` repo secret.

---

## Auto-push protocol (important: the bot pushes constantly)

The CI ingestor commits `public/offers.json` every ~15 min, so your push can be
rejected as non-fast-forward. Always rebase first:

```bash
# from repo root, after editing tracked files
git add -A
git commit -m "describe the change"
git pull --rebase            # replays your commit on top of the bot's offers.json commits
git push origin main
# if you had uncommitted changes when pulling: git stash → pull --rebase → stash pop
```

- **Never hand-edit `public/offers.json`** — the ingestor owns it.
- After pushing frontend/`public/` changes, the live site rebuilds in 30–90s.
- Add a CHANGELOG.md entry for anything significant (UI, logic, features, fixes).

---

## Roadmap / pending work

- **Tier 2 interactive email digest** (agreed direction; not built). Daily ~8am
  email of current offers, each card with ★ favorite / × hide links. The worker's
  `GET /action?type=favorite|hide|unhide&merchant=&percent=&token=` endpoint
  **already exists** for exactly this — the remaining work is a CI job that builds
  the HTML and sends via Gmail SMTP (needs a Gmail app password). This also makes
  favorites genuinely cross-device if combined with a single shared sync token.
- **Phase 3 — visit-to-trigger** (experimental, deferred). A wishlist of merchants
  + a Mac `launchd` job that opens a store page in Safari (where the C1 extension can
  fire an offer). Mechanism is sound; payoff is empirical. Mac-only by nature.
- **CI worker deploys** (enabler for full mobile). Add `CLOUDFLARE_API_TOKEN` secret
  + a workflow that runs `wrangler deploy` on changes to `sync-worker/**`.
- **Node 20 → 24 in Actions.** `actions/*` emit Node20 deprecation warnings
  (non-blocking; hard cutoff mid-2026). Bump action versions when convenient.
- **Gmail archive filter** (user task, not code): a filter to skip-inbox + label
  C1 emails. Safe — the ingestor searches all mail, so archived mail is still found.
  Do **not** trash them: Gmail search excludes Trash and auto-deletes after 30 days.

---

## Known issues / open questions

- **✅ Cross-device sync — FIXED 2026-06-07.** Previously `bootstrapSyncToken()` minted
  a per-device `crypto.randomUUID()` when the app was opened without `?sync=`, giving
  each device a *private* KV bucket (green dot, but no real sharing). Now every device
  defaults to a shared token (`SHARED_SYNC_TOKEN` in `index.html`), so all devices
  read/write one bucket = true cross-device sync with zero setup. Legacy random-UUID
  tokens auto-migrate to the shared token on next load, so existing devices reconverge
  after one refresh. `?sync=OTHER` still overrides for a custom/private namespace.
  Caveats: (1) the token sits in client JS — a static site can't keep it secret — so
  the bucket is protected by obscurity only; fine for non-sensitive favorites/hidden
  data, not for anything private. (2) On first convergence it's last-writer-wins: the
  first device to load after the change seeds the shared bucket and others adopt it,
  so glance at favorites once and re-add anything missing.
- **✅ README sync section — FIXED 2026-06-14.** README previously described sync as
  opt-in (gray dot "by design"). Updated to match current always-on shared-token
  behavior: green/red in normal use, gray only briefly before bootstrap.
- **Local Mac copy may be stale.** A `…/Automation/capone-offers/` folder existed
  locally with **no `.git`** and old files (pre-rename). The real local working copy
  should be a fresh clone of `capone-shopping`. Dispatch is unaffected (it clones fresh).

---

## Dispatch kickoff — how to spin up the mobile thread

1. In Dispatch, connect GitHub (if not already) and select the **`CMR2334/capone-shopping`** repo.
2. Start a new session/thread on that repo.
3. Paste this as your first message:

> You are taking over the **capone-shopping** project (a Capital One Shopping offer
> tracker PWA). Do not write code yet. First read `HANDOFF.md` in full, then
> `CLAUDE.md`, `AGENTS.md`, `README.md`, and the top of `CHANGELOG.md`. Then reply
> with: (1) a 4–6 line summary of the current state, (2) what this environment can
> and cannot do per the capability matrix, and (3) the open issues — especially the
> cross-device sync question. Then wait for my task. Follow the auto-push protocol
> (rebase before push) and add a CHANGELOG entry for significant changes.

4. Pin/bookmark that thread in Dispatch — it's now your mobile control point for the project.

Because the context lives in these files (not the chat), you can start a fresh
Dispatch thread anytime and it will be just as capable. Keep HANDOFF.md updated at
the end of meaningful sessions so the next thread — on any device — stays current.
