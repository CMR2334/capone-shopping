# sync-worker

Cloudflare Worker that persists favorites + hidden state across devices for capone-shopping.

## Endpoints

- `GET /state` — returns `{ favorites, hidden, updatedAt }` (Bearer token required)
- `PUT /state` — writes `{ favorites, hidden }` (Bearer token required)
- `GET /action?token=...&type=favorite|hide|unhide&merchant=...&percent=...` — single-action endpoint for email links; returns a small HTML confirmation page
- `POST /refresh` — triggers a fresh Gmail ingest by dispatching the GitHub Actions workflow (Bearer token required; 60s KV cooldown). Requires the `GH_DISPATCH_TOKEN` secret; returns `501 not_configured` without it. Used by the app's refresh button.
- `GET /health` — `ok` (no auth)

## Reliable ingest scheduler

`wrangler.toml` defines a Cloudflare Cron Trigger (`17 * * * *`). Cloudflare's scheduler
fires on time, unlike GitHub's heavily-throttled `schedule:` cron, so the Worker's
`scheduled()` handler is the primary driver that keeps `offers.json` fresh — it dispatches
the GitHub ingest workflow hourly. Inert until `GH_DISPATCH_TOKEN` is set.

## Deploy

```bash
cd sync-worker
wrangler kv namespace create OFFERS_KV   # paste the id into wrangler.toml (first time only)
wrangler secret put SYNC_TOKEN           # random hex string (first time only)
wrangler secret put GH_DISPATCH_TOKEN    # fine-grained GitHub PAT — Actions: read/write on CMR2334/capone-shopping
wrangler deploy
```

`GH_DISPATCH_TOKEN` powers both `POST /refresh` (the app's refresh button) and the hourly
cron. Create the PAT at GitHub → Settings → Developer settings → Fine-grained tokens,
scoped to the `capone-shopping` repo with **Actions: Read and write**.
