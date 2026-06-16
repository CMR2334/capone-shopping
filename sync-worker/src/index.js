const ALLOWED_ORIGINS = [
  'https://cmr2334.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

async function readState(env, token) {
  const stored = await env.OFFERS_KV.get(`state:${token}`, 'json');
  return stored || { favorites: [], hidden: {}, updatedAt: null };
}

async function writeState(env, token, partial) {
  const current = await readState(env, token);
  const next = {
    favorites: Array.isArray(partial.favorites) ? partial.favorites : current.favorites,
    hidden:
      partial.hidden && typeof partial.hidden === 'object' ? partial.hidden : current.hidden,
    updatedAt: new Date().toISOString(),
  };
  await env.OFFERS_KV.put(`state:${token}`, JSON.stringify(next));
  return next;
}

function htmlResponse(title, message, color = '#003a6c') {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f7f4ec;color:#0f1d33;text-align:center;padding:20px}div{max-width:420px}h1{font-size:24px;margin:0 0 8px;color:${color};letter-spacing:-0.01em}p{color:#74757b;margin:0;font-size:14px}</style></head><body><div><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// Trigger the GitHub Actions ingest workflow (workflow_dispatch). Shared by the
// on-demand /refresh route and the scheduled() cron handler. Requires the
// GH_DISPATCH_TOKEN secret: a fine-grained PAT with Actions: read/write on the repo.
function dispatchIngest(env) {
  return fetch(
    'https://api.github.com/repos/CMR2334/capone-shopping/actions/workflows/ingest.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GH_DISPATCH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'capone-offers-sync',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/state') {
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return jsonResponse({ error: 'unauthorized' }, 401, cors);
      }

      if (request.method === 'GET') {
        return jsonResponse(await readState(env, token), 200, cors);
      }
      if (request.method === 'PUT') {
        let body;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'invalid json' }, 400, cors);
        }
        return jsonResponse(await writeState(env, token, body), 200, cors);
      }
      return jsonResponse({ error: 'method not allowed' }, 405, cors);
    }

    if (url.pathname === '/action') {
      const params = url.searchParams;
      const token = params.get('token');
      if (!token) {
        return htmlResponse('Unauthorized', 'Invalid or missing token.', '#c8262f');
      }

      const type = params.get('type');
      const merchant = params.get('merchant');
      if (!type || !merchant) {
        return htmlResponse('Missing parameters', 'Action URL is malformed.', '#c8262f');
      }

      const state = await readState(env, token);

      if (type === 'favorite') {
        const set = new Set(state.favorites);
        const wasIn = set.has(merchant);
        if (wasIn) set.delete(merchant);
        else set.add(merchant);
        await writeState(env, token, { ...state, favorites: [...set] });
        return htmlResponse(
          wasIn ? `${merchant} unfavorited` : `${merchant} favorited`,
          'Synced across your devices. You can close this tab.'
        );
      }

      if (type === 'hide') {
        const percent = parseFloat(params.get('percent') || '0');
        state.hidden[merchant] = percent;
        await writeState(env, token, state);
        return htmlResponse(
          `${merchant} hidden`,
          `Will reappear if it returns above ${percent}% back.`
        );
      }

      if (type === 'unhide') {
        delete state.hidden[merchant];
        await writeState(env, token, state);
        return htmlResponse(`${merchant} unhidden`, 'Will show again on next sync.');
      }

      return htmlResponse('Unknown action', 'Action type not recognized.', '#c8262f');
    }

    if (url.pathname === '/refresh') {
      // Lets the web app trigger a fresh Gmail ingest on demand. Gated by the sync
      // token + a short KV cooldown so this public endpoint can't spam CI. Without the
      // GH_DISPATCH_TOKEN secret it reports not_configured (the app falls back to a
      // plain re-pull of the published data).
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'method not allowed' }, 405, cors);
      }
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return jsonResponse({ error: 'unauthorized' }, 401, cors);
      }
      if (!env.GH_DISPATCH_TOKEN) {
        return jsonResponse({ status: 'not_configured' }, 501, cors);
      }

      const COOLDOWN_MS = 60000;
      const now = Date.now();
      const last = await env.OFFERS_KV.get('refresh:last');
      if (last && now - Number(last) < COOLDOWN_MS) {
        const retryInSeconds = Math.ceil((COOLDOWN_MS - (now - Number(last))) / 1000);
        return jsonResponse({ status: 'cooldown', retryInSeconds }, 429, cors);
      }
      // Reserve the slot before dispatching so rapid double-clicks can't double-fire.
      await env.OFFERS_KV.put('refresh:last', String(now), { expirationTtl: 300 });

      const ghRes = await dispatchIngest(env);
      if (ghRes.status === 204) {
        return jsonResponse({ status: 'triggered' }, 202, cors);
      }
      const detail = (await ghRes.text()).slice(0, 200);
      return jsonResponse({ status: 'github_error', code: ghRes.status, detail }, 502, cors);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('ok\n', { headers: { 'Content-Type': 'text/plain' } });
    }

    return new Response('Not found', { status: 404 });
  },

  // Cloudflare Cron Trigger (wrangler.toml [triggers]). Cloudflare's scheduler is
  // reliable, unlike GitHub's heavily-throttled cron, so this is the primary driver
  // for keeping offers.json fresh. Inert until GH_DISPATCH_TOKEN is set.
  async scheduled(event, env, ctx) {
    if (env.GH_DISPATCH_TOKEN) {
      ctx.waitUntil(dispatchIngest(env));
    }
  },
};
