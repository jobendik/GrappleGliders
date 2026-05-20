/**
 * Minimal Cloudflare Worker that implements the Grapple Gliders leaderboard contract.
 *
 *   GET  /leaderboard/{date}?limit=100  -> LeaderboardSubmission[]
 *   POST /leaderboard                   -> { ok: true }
 *
 * Storage: a single Workers KV namespace bound as `LEADERBOARD`. Each daily is
 * stored under `day:{date}` as a JSON array (capped at 1000 entries).
 *
 * Deploy:
 *   wrangler kv namespace create LEADERBOARD
 *   # paste the printed id into wrangler.toml
 *   wrangler deploy
 */

interface Env {
  LEADERBOARD: KVNamespace;
  /** Optional. If set, POSTs must include `Authorization: Bearer <key>` matching this. */
  API_KEY?: string;
}

interface Submission {
  date: string;
  seed: number;
  name: string;
  score: number;
  altitude: number;
  timestamp: number;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const MAX_PER_DAY = 1000;
const NAME_MAX = 16;
const SCORE_CAP = 10_000_000; // upper sanity cap — adjust if your highest legitimate score climbs higher.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: CORS_HEADERS });
}

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[^\p{L}\p{N}_\-. ]/gu, '').trim().slice(0, NAME_MAX);
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return text('', 204);

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname.startsWith('/leaderboard/')) {
      const date = sanitizeDate(decodeURIComponent(url.pathname.slice('/leaderboard/'.length)));
      if (!date) return json({ error: 'Invalid date' }, 400);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 100)));
      const raw = (await env.LEADERBOARD.get(`day:${date}`, 'json')) as Submission[] | null;
      const top = (raw ?? []).sort((a, b) => b.score - a.score).slice(0, limit);
      return json(top);
    }

    if (request.method === 'POST' && url.pathname === '/leaderboard') {
      if (env.API_KEY) {
        const auth = request.headers.get('Authorization') ?? '';
        if (auth !== `Bearer ${env.API_KEY}`) return json({ error: 'Unauthorized' }, 401);
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }
      if (!body || typeof body !== 'object') return json({ error: 'Bad payload' }, 400);
      const p = body as Record<string, unknown>;
      const date = sanitizeDate(p.date);
      const name = sanitizeName(p.name);
      const score = typeof p.score === 'number' && isFinite(p.score) ? Math.floor(p.score) : null;
      const altitude = typeof p.altitude === 'number' && isFinite(p.altitude) ? Math.max(0, Math.floor(p.altitude)) : 0;
      const seed = typeof p.seed === 'number' && isFinite(p.seed) ? Math.floor(p.seed) : 0;
      if (!date || !name || score === null || score < 0 || score > SCORE_CAP) {
        return json({ error: 'Invalid submission' }, 400);
      }
      const key = `day:${date}`;
      const existing = ((await env.LEADERBOARD.get(key, 'json')) as Submission[] | null) ?? [];
      const idx = existing.findIndex((s) => s.name === name);
      const submission: Submission = { date, name, score, altitude, seed, timestamp: Date.now() };
      if (idx >= 0) {
        // Keep the higher score; never let a later run lower the rank.
        if (existing[idx]!.score >= score) {
          return json({ ok: true, kept: 'existing' });
        }
        existing[idx] = submission;
      } else {
        existing.push(submission);
      }
      const top = existing.sort((a, b) => b.score - a.score).slice(0, MAX_PER_DAY);
      // KV with 30-day expiry per daily — beyond that, the page won't show them anyway.
      await env.LEADERBOARD.put(key, JSON.stringify(top), { expirationTtl: 60 * 60 * 24 * 60 });
      return json({ ok: true });
    }

    return text('Not found', 404);
  },
};
