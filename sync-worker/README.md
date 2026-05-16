# sync-worker

Cloudflare Worker that persists favorites + hidden state across devices for capone-shopping.

## Endpoints

- `GET /state` — returns `{ favorites, hidden, updatedAt }` (Bearer token required)
- `PUT /state` — writes `{ favorites, hidden }` (Bearer token required)
- `GET /action?token=...&type=favorite|hide|unhide&merchant=...&percent=...` — single-action endpoint for email links; returns a small HTML confirmation page
- `GET /health` — `ok` (no auth)

## Deploy

```bash
cd sync-worker
wrangler kv namespace create OFFERS_KV   # paste the id into wrangler.toml
wrangler secret put SYNC_TOKEN           # paste a random hex string
wrangler deploy
```
