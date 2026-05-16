const ALLOWED_ORIGINS = [
  'https://cmr2334.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('ok\n', { headers: { 'Content-Type': 'text/plain' } });
    }

    return new Response('Not found', { status: 404 });
  },
};
