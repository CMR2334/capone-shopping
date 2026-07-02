# Visit-to-trigger ("offer baiting") — design & rollout plan

Status: **v1 shipped as a Mac-side skeleton** (`bait/`), v2+ planned below.
Roadmap origin: HANDOFF.md → "Phase 3 — visit-to-trigger".

## The idea

Capital One Shopping's offer targeting appears to respond to shopping intent:
browsing a merchant's site with the C1S browser extension installed (or browsing
merchant pages on capitaloneshopping.com) can cause C1S to send an **elevated,
often single-use offer email** for that merchant within hours-to-days. This
project already ingests those emails every 15 minutes, so the *measurement* half
of the loop exists for free — if baiting works for a merchant, the elevated
offer shows up in the tracker automatically.

Goal: let Collin **mark a vendor as a target**, and have a **background process
visit that vendor's site** in a browser where the C1S extension is active, to
try to provoke an elevated offer.

## Constraints that shape the design

1. **The extension only runs in a real desktop browser on the Mac.** No CI or
   cloud environment can do the visiting — GitHub Actions has no C1S session,
   and headless browsers are pointless without the extension + logged-in C1S
   account. Per HANDOFF's capability matrix, this feature is *Mac-only by
   nature*; everything else (target list, UI, measurement) can live in the
   existing repo/CI/PWA stack.
2. **Volume must stay human-scale.** This is a personal account nudging a
   recommender, not scraping. A handful of merchant visits per day, staggered
   at human-ish intervals, from the user's own logged-in browser. Anything
   bot-like risks C1S discounting the signal or flagging the account. The
   skeleton enforces a per-run cap and randomized stagger.
3. **Don't click `activationUrl` as the bait.** Each offer already carries a
   C1S wrapped `activationUrl`. Clicking it *activates the current offer*
   (and for single-use offers may consume targeting), which is the opposite of
   fishing for a better one. Baiting = organic-looking merchant-site visits;
   activation stays a deliberate user action in the PWA.

## Architecture (target state)

```
PWA (public/index.html)                    Mac (launchd, e.g. 2×/day)
  🎯 target toggle per offer card   ─┐       bait/visit-targets.sh
  + free-form "add vendor" box      │         1. git pull --ff-only
        │                           │         2. read bait/targets.json
        ▼                           │         3. resolve URL per target
sync-worker /state  { targets: [] } ┘            (explicit url, or domain
        ▲                                         from offers.json logoUrl)
        │  (v2 — needs worker deploy)          4. open N sites in Safari,
bait/targets.json  (v1 — file in repo) ──▶        randomized stagger
                                               5. log to bait/visits.log
Measurement: ingestor (existing, unchanged)
  elevated offer email → offers.json → PWA; compare percentBack before/after
```

## Rollout phases

### v1 — file-driven wishlist + launchd visitor (shipped in this PR)

- `bait/targets.json` — the wishlist. Editable from any device (GitHub app /
  Dispatch / desktop); the Mac job pulls before each run. Entry shape:

  ```json
  { "merchant": "Blinds.com", "url": null, "active": true, "note": "optional" }
  ```

  `url: null` means "derive it": the script looks the merchant up in
  `public/offers.json` and extracts the store domain from the offer's
  `logoUrl` (`…logos?domain=blinds.com…`). Merchants not currently in the
  feed need an explicit `url`.
- `bait/visit-targets.sh` — opens each active target in Safari (where the C1S
  extension lives), staggered 45–120 s apart, capped at `MAX_VISITS_PER_RUN`
  (default 5). Logs to `bait/visits.log` (gitignored).
- `bait/com.collin.capone-bait.plist` — launchd template, default 10:30 and
  19:30 daily. Install:

  ```bash
  cp bait/com.collin.capone-bait.plist ~/Library/LaunchAgents/
  # edit the two REPLACE_ME paths first, then:
  launchctl load ~/Library/LaunchAgents/com.collin.capone-bait.plist
  ```

  See `bait/README.md` for details and manual-run instructions.

### v2 — target toggle in the PWA (planned, ~1 session)

- Add `targets: []` alongside `favorites`/`hidden` in the sync-worker state
  (`sync-worker/src/index.js` `readState`/`writeState`), plus an
  `/action?type=target|untarget` branch for email-digest links later.
- Frontend: a 🎯 toggle on each offer card (same pattern as ★ favorite) and a
  small "target a vendor not in the feed" input; both write to synced state.
- `visit-targets.sh` step 2 becomes: `curl -H "Authorization: Bearer $SYNC_TOKEN"
  https://capone-offers-sync.cmr2334.workers.dev/state` and read `.targets`,
  falling back to `bait/targets.json` if the worker is unreachable.
- **Blocker/dependency:** worker deploys need `wrangler` auth on the Mac (or
  the roadmap's CI-worker-deploys item). Frontend part is doable from any
  device today.

### v3 — measurement & tuning (planned, opportunistic)

- The ingestor already timestamps every offer (`emailDate`) and keeps the best
  per merchant. Add a tiny report (CI step or PWA panel) that, for each target,
  shows: `percentBack` at targeting time → best `percentBack` since first
  visit → days-to-elevation. After ~4–6 weeks, keep/kill the feature on data.
- Possible tuning knobs if results are weak: visit product pages instead of
  home pages, add a second visit to a cart page, vary time-of-day, or browse
  the merchant page on capitaloneshopping.com itself.

## Risks / notes

- **Efficacy is empirical.** HANDOFF already flags this: "mechanism is sound;
  payoff is empirical." v3 exists to answer it with data.
- **ToS posture:** the script only opens normal pages in the user's own Safari
  at low volume — no scraping, no purchase automation, no credential handling.
  Keep it that way; don't raise caps or add headless automation.
- **Safari vs Chrome:** the plist/script default to Safari per the roadmap
  note. If the C1S extension actually lives in Chrome on the Mac, set
  `BROWSER_APP="Google Chrome"` in the script — verify before first install.
- The Mac clone used by launchd must be a real clone of `capone-shopping`
  (HANDOFF notes a stale pre-rename `capone-offers` folder exists locally —
  don't point the plist at that).
