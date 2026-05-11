# capone-offers

Capital One Shopping offer tracker. Pulls offer emails from Gmail, parses merchant / % back / expiration / activation link, surfaces them in a PWA, and auto-removes expired offers.

- Live URL: TBD (GitHub Pages, populated after first deploy)
- Source inbox: `cmreko91@gmail.com`
- Sender filter: `hello@capitaloneshopping.com`

## Layout

- `ingestor/` — Node scripts run by GitHub Actions on a cron
  - `auth.js` — one-time OAuth flow, produces `token.json`
  - `ingest.js` — pulls + parses + writes `public/offers.json` (added next)
- `public/` — static PWA served by GitHub Pages
- `.github/workflows/ingest.yml` — cron job (added next)

## Setup (one-time)

1. Drop your Google Cloud OAuth desktop `client_secret.json` into the project root.
2. `npm install`
3. `npm run auth` — opens browser; sign in with `cmreko91@gmail.com`; refresh token saved to `token.json`.
