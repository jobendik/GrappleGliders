# Leaderboard server

The game's `LeaderboardBackend` interface needs two endpoints:

| Method | Path                   | Purpose                                |
| ------ | ---------------------- | -------------------------------------- |
| `GET`  | `/leaderboard/{date}`  | Top N submissions for the UTC date.    |
| `POST` | `/leaderboard`         | Insert / upgrade a player's score.     |

`{date}` is the UTC `YYYY-MM-DD` for the daily challenge — passed through unescaped from the client.

## Wire contract

```ts
interface LeaderboardSubmission {
  date: string;       // 'YYYY-MM-DD' (UTC)
  seed: number;       // The challenge seed (informational; server may ignore).
  name: string;       // 1..16 chars; server should clamp/sanitize.
  score: number;      // Non-negative integer.
  altitude: number;   // Non-negative integer (metres).
  timestamp: number;  // ms since epoch.
}
```

- `GET /leaderboard/{date}?limit=100` returns `LeaderboardSubmission[]` sorted by `score` descending.
- `POST /leaderboard` accepts a `LeaderboardSubmission` JSON body. If a row for the same `(date, name)` already exists, keep the higher score.
- Both endpoints **must** include CORS headers so the browser game (served from the CrazyGames iframe or the dev host) can call them.

## Reference: Cloudflare Worker + KV

The fastest path to a real backend. Free tier handles ~100k daily requests, which is plenty for the daily challenge.

1. Install Wrangler: `npm i -g wrangler && wrangler login`
2. Create a KV namespace: `wrangler kv namespace create LEADERBOARD`
3. Replace the `id` in `wrangler.toml` with the printed namespace id.
4. Deploy: `wrangler deploy`
5. Copy the worker URL into your `.env.local` as `VITE_LEADERBOARD_API_URL`.

See `cloudflare-worker.ts` and `wrangler.toml` in this directory.

## Reference: Supabase REST

Supabase's PostgREST handles the contract with a single table and two RLS policies.

1. Create the table:
   ```sql
   create table leaderboard_submissions (
     id bigserial primary key,
     date text not null,
     seed bigint default 0,
     name text not null,
     score integer not null check (score >= 0),
     altitude integer not null default 0,
     timestamp bigint not null,
     unique (date, name)
   );
   create index on leaderboard_submissions (date, score desc);
   ```
2. Enable row-level security and add policies allowing anonymous select on the table plus insert / update on `(date, name)`.
3. Deploy a Postgres function `submit_score(payload jsonb)` that performs an upsert keeping the higher score; expose it via PostgREST and POST to it from the game.
4. Set `VITE_LEADERBOARD_API_URL=https://<project>.supabase.co/rest/v1`, `VITE_LEADERBOARD_API_KEY=<anon-key>`, `VITE_LEADERBOARD_FETCH_PATH=/leaderboard_submissions?date=eq.{date}&order=score.desc.nullslast&limit=100`, and `VITE_LEADERBOARD_SUBMIT_PATH=/rpc/submit_score`.

## Local fallback behaviour

`LayeredLeaderboardBackend` (in `src/systems/LeaderboardSystem.ts`) wraps any remote backend with the local one. When the network call fails the game silently falls back to the player's own historical submissions blended with the seeded bots, so the daily challenge is never blocked by an outage.

## Anti-cheat notes

The reference Cloudflare Worker keeps it intentionally minimal — production deployments should add:

- Rate limiting per IP / per session (Cloudflare Bot Management or a Durable Object counter).
- Score sanity caps per date (reject submissions above a plausible ceiling).
- Optional signed payload from the game (HMAC of `date|name|score` with a server-shared secret embedded at build time) to deter casual tampering.

These are deliberately out of scope for the reference because the most effective anti-cheat depends on the deployment topology.
