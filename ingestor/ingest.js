const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { parseCaponeEmail } = require('./parser');

const ROOT = path.resolve(__dirname, '..');
const CLIENT_SECRET_PATH = path.join(ROOT, 'client_secret.json');
const TOKEN_PATH = path.join(ROOT, 'token.json');
const OFFERS_PATH = path.join(ROOT, 'public', 'offers.json');
const RAW_DIR = path.join(ROOT, 'ingestor', 'raw');

const SENDER = 'hello@capitaloneshopping.com';
const LOOKBACK_DAYS = 30;
const SAVE_RAW = process.env.SAVE_RAW === '1';

function getOAuthClient() {
  let client_id, client_secret, refresh_token;
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
    client_id = process.env.GMAIL_CLIENT_ID;
    client_secret = process.env.GMAIL_CLIENT_SECRET;
    refresh_token = process.env.GMAIL_REFRESH_TOKEN;
  } else {
    const creds = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf8'));
    ({ client_id, client_secret } = creds.installed || creds.web);
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    refresh_token = tokens.refresh_token;
  }
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
  oauth2Client.setCredentials({ refresh_token });
  return oauth2Client;
}

async function main() {
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);
  const afterSec = Math.floor(lookbackDate.getTime() / 1000);
  const query = `from:${SENDER} after:${afterSec}`;
  console.log(`Search: ${query}`);

  const listRes = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100 });
  const messages = listRes.data.messages || [];
  console.log(`Found ${messages.length} messages`);

  const allOffers = [];
  let parseFailures = 0;

  if (SAVE_RAW) fs.mkdirSync(RAW_DIR, { recursive: true });

  for (const msg of messages) {
    // One bad message (API hiccup, unexpected payload, parser throw) must not abort
    // the whole run — catch per-message, count it, and keep going.
    let html = null;
    try {
      const msgRes = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const internalDate = parseInt(msgRes.data.internalDate, 10);
      const subject = headerValue(msgRes.data.payload.headers, 'Subject');
      html = extractHtml(msgRes.data.payload);

      if (!html) { console.warn(`  No HTML body for ${msg.id} — skipping`); parseFailures++; continue; }
      if (SAVE_RAW) fs.writeFileSync(path.join(RAW_DIR, `${msg.id}.html`), html);

      const { offers } = parseCaponeEmail(html, {
        messageId: msg.id,
        date: new Date(internalDate).toISOString(),
        subject,
      });
      console.log(`  ${new Date(internalDate).toISOString().slice(0,10)} [${msg.id.slice(0,8)}] "${subject?.slice(0,50) || '?'}" → ${offers.length} offers`);
      allOffers.push(...offers);
    } catch (err) {
      console.error(`  Message ${msg.id} failed: ${err.message}`);
      // Dump the raw HTML (only when we got this far) so a parse failure is reproducible locally.
      if (html && !SAVE_RAW) {
        fs.mkdirSync(RAW_DIR, { recursive: true });
        fs.writeFileSync(path.join(RAW_DIR, `failed-${msg.id}.html`), html);
      }
      parseFailures++;
    }
  }

  const now = new Date();
  const merged = mergeOffers(allOffers, now);

  // Safety guard: if there were source emails but NONE produced an offer, something is
  // broken (parser regression, auth/format change). Don't overwrite a good feed with an
  // empty one — exit non-zero so CI flags it and the existing offers.json is kept.
  if (messages.length > 0 && allOffers.length === 0) {
    console.error(`\nAll ${messages.length} message(s) yielded 0 offers — refusing to overwrite ${OFFERS_PATH}. Leaving the existing feed in place.`);
    process.exit(1);
  }

  const output = {
    lastUpdated: now.toISOString(),
    sourceCount: messages.length,
    parseFailures,
    offers: merged,
    upcomingReveals: [],
  };

  fs.mkdirSync(path.dirname(OFFERS_PATH), { recursive: true });
  fs.writeFileSync(OFFERS_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${merged.length} active offers to ${OFFERS_PATH}`
    + (parseFailures ? ` (${parseFailures} message(s) failed to parse)` : ''));
}

function extractHtml(payload) {
  if (!payload) return null;
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const html = extractHtml(part);
      if (html) return html;
    }
  }
  return null;
}

function headerValue(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function mergeOffers(offers, now) {
  const rewardValue = o => o.percentBack != null ? o.percentBack : (o.dollarBack ?? 0);
  const timestamp = value => {
    const parsed = Date.parse(value || '');
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const shouldReplace = (existing, candidate) => {
    const sameRewardType = (existing.percentBack != null) === (candidate.percentBack != null);
    const existingValue = rewardValue(existing);
    const candidateValue = rewardValue(candidate);

    // Percentage and flat-dollar rewards are only directly comparable with offers
    // of the same type. Preserve the old expiry-first behavior for mixed types.
    if (sameRewardType && candidateValue !== existingValue) {
      return candidateValue > existingValue;
    }

    const existingExpiry = timestamp(existing.expiresAt);
    const candidateExpiry = timestamp(candidate.expiresAt);
    if (candidateExpiry !== existingExpiry) return candidateExpiry > existingExpiry;

    if (!sameRewardType && candidateValue !== existingValue) {
      return candidateValue > existingValue;
    }

    return timestamp(candidate.emailDate) > timestamp(existing.emailDate);
  };

  const byMerchant = new Map();
  for (const offer of offers) {
    if (offer.expiresAt && timestamp(offer.expiresAt) <= now.getTime()) continue;
    const key = offer.merchant.toLowerCase().trim();
    const existing = byMerchant.get(key);
    if (!existing) { byMerchant.set(key, offer); continue; }
    if (shouldReplace(existing, offer)) byMerchant.set(key, offer);
  }
  return [...byMerchant.values()]
    .sort((a, b) => (b.percentBack ?? -1) - (a.percentBack ?? -1) || (b.dollarBack ?? 0) - (a.dollarBack ?? 0));
}

if (require.main === module) {
  main().catch(err => {
    console.error('Ingest failed:', err);
    process.exit(1);
  });
}

module.exports = { mergeOffers };
