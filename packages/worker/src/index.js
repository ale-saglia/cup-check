const CHUNK_SIZE = 100;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return reply(null, 204);
    }

    if (request.method !== 'POST' || url.pathname !== '/lookup') {
      return reply('Not Found', 404, 'text/plain');
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return reply(JSON.stringify({ error: 'invalid JSON' }), 400);
    }

    const cups = Array.isArray(body?.cups)
      ? body.cups.filter((c) => typeof c === 'string')
      : [];

    if (cups.length === 0) {
      return reply('{}', 200);
    }

    const found = new Set();
    try {
      for (let i = 0; i < cups.length; i += CHUNK_SIZE) {
        const chunk = cups.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(', ');
        const { results } = await env.DB.prepare(
          `SELECT cup FROM cups WHERE cup IN (${placeholders})`,
        )
          .bind(...chunk)
          .all();
        for (const row of results) found.add(row.cup);
      }
    } catch (err) {
      console.error('D1 query failed:', err);
      return reply(JSON.stringify({ error: 'database unavailable' }), 503);
    }

    const out = {};
    for (const cup of cups) out[cup] = found.has(cup);
    return reply(JSON.stringify(out), 200);
  },
};

function reply(body, status, contentType = 'application/json') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
