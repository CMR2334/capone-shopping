# bait/ — visit-to-trigger (offer baiting)

Mac-side skeleton for provoking elevated Capital One Shopping offers by
visiting target vendors' sites in a browser where the C1S extension is active.
Full design and rollout plan: **[docs/VISIT_TO_TRIGGER.md](../docs/VISIT_TO_TRIGGER.md)**.

| File | Purpose |
|---|---|
| `targets.json` | The wishlist. Edit from any device and push; the Mac job pulls first. |
| `visit-targets.sh` | Opens active targets in Safari, staggered, ≤5 per run. Mac-only. |
| `com.collin.capone-bait.plist` | launchd template (10:30 + 19:30 daily). |
| `visits.log` | Run log (gitignored, created on first run). |

## One-time install (on the Mac)

```bash
brew install jq                       # if not already installed
chmod +x bait/visit-targets.sh        # should already be executable from git
./bait/visit-targets.sh               # manual smoke test first

# then schedule it:
sed "s|REPLACE_ME|$PWD|g" bait/com.collin.capone-bait.plist \
  > ~/Library/LaunchAgents/com.collin.capone-bait.plist
launchctl load ~/Library/LaunchAgents/com.collin.capone-bait.plist
```

If the C1S extension is installed in Chrome rather than Safari, run with
`BROWSER_APP="Google Chrome"` (or edit the default in the script) — check
which browser actually has the extension before installing the launchd job.

## Adding a target (from anywhere, incl. phone)

Edit `bait/targets.json` on GitHub → set `"active": true`. If the vendor is
already in the offer feed, leave `"url": null` and the script derives the
store URL from `offers.json`; otherwise supply the URL explicitly.
