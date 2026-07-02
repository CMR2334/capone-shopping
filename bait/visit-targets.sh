#!/bin/zsh
# visit-targets.sh — open target vendors' sites in a real browser so the
# Capital One Shopping extension sees shopping intent (see docs/VISIT_TO_TRIGGER.md).
# Mac-only: relies on `open -a` and a browser where the C1S extension is active.
#
# Run manually:   ./bait/visit-targets.sh
# Or via launchd: bait/com.collin.capone-bait.plist
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BROWSER_APP="${BROWSER_APP:-Safari}"        # set to "Google Chrome" if the extension lives there
MAX_VISITS_PER_RUN="${MAX_VISITS_PER_RUN:-5}"
STAGGER_MIN=45; STAGGER_MAX=120             # seconds between visits (randomized)
LOG_FILE="$REPO_DIR/bait/visits.log"

log() { print -r -- "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" | tee -a "$LOG_FILE"; }

cd "$REPO_DIR"
git pull --ff-only origin main >/dev/null 2>&1 || log "WARN git pull failed; using local copies"

if ! command -v jq >/dev/null; then
  log "ERROR jq not installed (brew install jq)"; exit 1
fi

# Active targets: "merchant<TAB>url-or-empty"
targets=("${(@f)$(jq -r '.targets[] | select(.active == true) | [.merchant, (.url // "")] | @tsv' bait/targets.json)}")
if [[ -z "${targets[1]:-}" ]]; then
  log "No active targets — nothing to do."; exit 0
fi

count=0
for line in "${targets[@]}"; do
  (( count >= MAX_VISITS_PER_RUN )) && { log "Cap of $MAX_VISITS_PER_RUN visits reached; remaining targets skipped this run."; break; }
  merchant="${line%%$'\t'*}"
  url="${line#*$'\t'}"

  # No explicit url: derive the store domain from the merchant's offer logoUrl
  # in offers.json (…logos?domain=store.com…).
  if [[ -z "$url" ]]; then
    domain=$(jq -r --arg m "$merchant" \
      '.offers[] | select(.merchant | ascii_downcase == ($m | ascii_downcase)) | .logoUrl // ""' \
      public/offers.json | head -1 | sed -n 's/.*[?&]domain=\([^&]*\).*/\1/p')
    if [[ -z "$domain" ]]; then
      log "SKIP $merchant — no url in targets.json and not found in offers.json"
      continue
    fi
    url="https://www.$domain"
  fi

  (( count > 0 )) && sleep $(( STAGGER_MIN + RANDOM % (STAGGER_MAX - STAGGER_MIN) ))
  log "VISIT $merchant → $url"
  open -a "$BROWSER_APP" "$url"
  (( count++ )) || true
done

log "Done — $count visit(s) this run."
