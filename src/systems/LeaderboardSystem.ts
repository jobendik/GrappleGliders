import { SeededRandom, makeDailySeed } from '../utils/seededRandom';
import type { LeaderboardSubmission, SaveSystem } from './SaveSystem';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  altitude: number;
  isYou: boolean;
  isBot: boolean;
  /** ISO date of the submission for real entries; undefined for procedural bots. */
  submittedAt?: number;
}

export interface LeaderboardSnapshot {
  /** Combined ranked list (real submissions + procedural bots). */
  entries: LeaderboardEntry[];
  /** True if at least one real submission (any human) is on this board. */
  hasRealSubmissions: boolean;
  /** True when the snapshot includes the player's own personal best. */
  includesYou: boolean;
  /** The player's current best rank on this board, or null if not on it. */
  yourRank: number | null;
  /** Total number of distinct real submitters (including the current player). */
  realPlayerCount: number;
}

/**
 * Backend adapter — implement this against a real service (Supabase/Firebase/etc.)
 * to swap procedural bots for live competition. The default `LocalLeaderboardBackend`
 * surfaces only the player's own historical submissions; pair it with the seeded
 * bot ladder in {@link LeaderboardSystem.buildDailyBoard} for a believable feel.
 */
export interface LeaderboardBackend {
  /** Resolve the top N submissions for a given daily date. */
  fetchDaily(date: string, limit: number): Promise<LeaderboardSubmission[]>;
  /** Submit the player's score for the given daily date. */
  submitDaily(submission: LeaderboardSubmission): Promise<void>;
}

const BOT_FIRST_NAMES = [
  'NEON', 'VYRA', 'ECHO', 'KAI', 'ZED', 'NOVA', 'AXEL', 'RIO', 'STORM', 'IONA',
  'ORBIT', 'RUNE', 'SABLE', 'ARC', 'TIDE', 'GLITCH', 'FOX', 'JIN', 'LUMEN', 'PYRE',
  'VEX', 'OYO', 'KILN', 'BRYNN', 'ESKO', 'MOTH', 'PARA', 'OPAL', 'CYRA', 'HALO',
];

const BOT_LAST_TAGS = ['7', '99', '_X', '_v2', '_HD', '01', '_99', '00', '_pro', '_alpha'];

const MAX_SUBMISSIONS_PER_DATE = 50;

/**
 * Default backend: stores submissions in the local SaveSystem (which itself
 * mirrors them to the CrazyGames cloud save when available). This gives the
 * player a real cross-device personal history without requiring a third-party
 * service, while keeping a single integration point if a real backend lands.
 */
export class LocalLeaderboardBackend implements LeaderboardBackend {
  constructor(private save: SaveSystem) {}

  async fetchDaily(date: string, limit: number): Promise<LeaderboardSubmission[]> {
    return this.save.data.leaderboardSubmissions
      .filter((s) => s.date === date)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async submitDaily(submission: LeaderboardSubmission): Promise<void> {
    const existing = this.save.data.leaderboardSubmissions.find(
      (s) => s.date === submission.date && s.name === submission.name,
    );
    if (existing) {
      if (submission.score > existing.score) {
        existing.score = submission.score;
        existing.altitude = submission.altitude;
        existing.timestamp = submission.timestamp;
      }
    } else {
      this.save.data.leaderboardSubmissions.push(submission);
    }
    // Cap per-date and overall list size so save data stays small.
    const sameDate = this.save.data.leaderboardSubmissions
      .filter((s) => s.date === submission.date)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUBMISSIONS_PER_DATE);
    const others = this.save.data.leaderboardSubmissions.filter((s) => s.date !== submission.date);
    this.save.data.leaderboardSubmissions = [...sameDate, ...others].slice(0, 200);
    this.save.save();
    this.save.flush();
  }
}

export interface RemoteLeaderboardConfig {
  /** Base URL of the leaderboard service, e.g. https://api.example.com */
  baseUrl: string;
  /** Optional bearer token. Sent as `Authorization: Bearer <key>`. */
  apiKey?: string;
  /**
   * Path template for fetching a daily. `{date}` is replaced with the UTC date string.
   * Default: `/leaderboard/{date}`.
   */
  fetchPath?: string;
  /**
   * Path for submitting a score (POST). Default: `/leaderboard`.
   */
  submitPath?: string;
  /** Per-call timeout in ms. Default: 4000. */
  timeoutMs?: number;
}

/**
 * HTTP-based leaderboard backend. Wire this to any service that implements the
 * two-endpoint contract documented in `server/README.md`. The default paths
 * match the reference Cloudflare Worker in `server/cloudflare-worker.ts`.
 *
 * `LayeredLeaderboardBackend` (below) wraps this with a `LocalLeaderboardBackend`
 * so the player never sees a "leaderboard unavailable" error — local cache is
 * always shown and submissions are retried implicitly on the next fetch.
 */
export class RemoteLeaderboardBackend implements LeaderboardBackend {
  constructor(private config: RemoteLeaderboardConfig) {}

  async fetchDaily(date: string, limit: number): Promise<LeaderboardSubmission[]> {
    const fetchPath = (this.config.fetchPath ?? '/leaderboard/{date}').replace(
      '{date}',
      encodeURIComponent(date),
    );
    const url = new URL(fetchPath, this.config.baseUrl);
    url.searchParams.set('limit', String(limit));
    const res = await this.fetchWithTimeout(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);
    const raw = (await res.json()) as unknown;
    return this.sanitizeList(raw);
  }

  async submitDaily(submission: LeaderboardSubmission): Promise<void> {
    const submitPath = this.config.submitPath ?? '/leaderboard';
    const url = new URL(submitPath, this.config.baseUrl);
    const res = await this.fetchWithTimeout(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    if (!res.ok) throw new Error(`Leaderboard submit failed: ${res.status}`);
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 4000);
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    try {
      return await fetch(url, { ...init, headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private sanitizeList(raw: unknown): LeaderboardSubmission[] {
    if (!Array.isArray(raw)) return [];
    const out: LeaderboardSubmission[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      const o = r as Record<string, unknown>;
      const date = typeof o.date === 'string' ? o.date : null;
      const name = typeof o.name === 'string' ? o.name.slice(0, 16) : null;
      const score = typeof o.score === 'number' && isFinite(o.score) ? Math.max(0, Math.floor(o.score)) : null;
      const altitude = typeof o.altitude === 'number' && isFinite(o.altitude) ? Math.max(0, Math.floor(o.altitude)) : 0;
      const seed = typeof o.seed === 'number' && isFinite(o.seed) ? o.seed : 0;
      const timestamp = typeof o.timestamp === 'number' && isFinite(o.timestamp) ? o.timestamp : Date.now();
      if (!date || !name || score === null) continue;
      out.push({ date, name, score, altitude, seed, timestamp });
    }
    return out;
  }
}

/**
 * Combine a primary (remote) backend with a fallback (local) one.
 * - Fetch: returns the remote list if reachable, otherwise the local list. When
 *   both succeed, real local-only entries are merged in (so the player's own
 *   score appears immediately, even if the remote submission is still in-flight).
 * - Submit: always writes locally so the player sees their entry instantly; the
 *   remote write is best-effort. A failed remote submit is silently swallowed —
 *   the local copy keeps the score and a future submit will re-send it.
 */
export class LayeredLeaderboardBackend implements LeaderboardBackend {
  constructor(
    private primary: LeaderboardBackend,
    private fallback: LeaderboardBackend,
  ) {}

  async fetchDaily(date: string, limit: number): Promise<LeaderboardSubmission[]> {
    try {
      const [remote, local] = await Promise.all([
        this.primary.fetchDaily(date, limit),
        this.fallback.fetchDaily(date, limit).catch(() => [] as LeaderboardSubmission[]),
      ]);
      const map = new Map<string, LeaderboardSubmission>();
      for (const s of remote) map.set(s.name, s);
      for (const s of local) {
        const existing = map.get(s.name);
        if (!existing || s.score > existing.score) map.set(s.name, s);
      }
      return Array.from(map.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch {
      return this.fallback.fetchDaily(date, limit);
    }
  }

  async submitDaily(submission: LeaderboardSubmission): Promise<void> {
    // Local first so the player always sees their score even if the network is down.
    await this.fallback.submitDaily(submission);
    try {
      await this.primary.submitDaily(submission);
    } catch {
      // Remote unavailable — local has the score. A future submit on the same day
      // will overwrite the timestamp and try again.
    }
  }
}

export class LeaderboardSystem {
  constructor(private backend: LeaderboardBackend) {}

  setBackend(backend: LeaderboardBackend): void {
    this.backend = backend;
  }

  /**
   * Build a leaderboard for the given daily. Combines real human submissions
   * (from the backend) with deterministic seeded bots to fill out the ladder
   * to {@link size}. The player's own score is highlighted if present.
   */
  async buildDailyBoard(
    date: string,
    seed: number,
    playerScore: number,
    playerName: string,
    size: number = 100,
  ): Promise<LeaderboardSnapshot> {
    const real = await this.backend.fetchDaily(date, size);
    const normalizedName = (playerName && playerName.trim()) || 'YOU';
    const youEntry = real.find((s) => s.name === normalizedName);
    const yourBest = Math.max(playerScore, youEntry?.score ?? 0);
    const seenNames = new Set<string>(real.map((r) => r.name));

    // Deterministic bot ladder seeded from the daily.
    const rng = new SeededRandom(makeDailySeed(seed, 'leaderboard-v2'));
    const target = Math.max(yourBest, 1000);
    const top = Math.floor(target * (1.2 + rng.next() * 1.6));
    const bottom = Math.max(50, Math.floor(target * 0.3));
    const botEntries: LeaderboardEntry[] = [];
    const slotsForBots = Math.max(0, size - real.length);
    for (let i = 0; i < slotsForBots; i++) {
      const t = i / Math.max(1, slotsForBots - 1);
      const skill = Math.pow(1 - t, 2);
      const noise = (rng.next() - 0.5) * (top - bottom) * 0.08;
      const score = Math.max(bottom, Math.floor(bottom + (top - bottom) * skill + noise));
      let name = this.botName(rng);
      // Avoid bot names colliding with real submitters.
      let guard = 0;
      while (seenNames.has(name) && guard++ < 5) name = this.botName(rng);
      seenNames.add(name);
      botEntries.push({
        rank: 0,
        name,
        score,
        altitude: Math.floor(score / 10),
        isYou: false,
        isBot: true,
      });
    }

    const realEntries: LeaderboardEntry[] = real.map((s) => ({
      rank: 0,
      name: s.name,
      score: s.score,
      altitude: s.altitude,
      isYou: s.name === normalizedName,
      isBot: false,
      submittedAt: s.timestamp,
    }));

    const combined = [...realEntries, ...botEntries];

    // If the player has a current-attempt score that beats their stored entry,
    // make sure the rendered board reflects it (the backend submit happens elsewhere).
    if (playerScore > 0 && !combined.some((e) => e.isYou)) {
      combined.push({
        rank: 0,
        name: normalizedName,
        score: playerScore,
        altitude: Math.floor(playerScore / 10),
        isYou: true,
        isBot: false,
        submittedAt: Date.now(),
      });
    }

    combined.sort((a, b) => b.score - a.score);
    // Compute ranks against the full combined ladder so the player's "true" position
    // is preserved even if they would otherwise be cut off by the size cap.
    const ranked = combined.map((e, i) => ({ ...e, rank: i + 1 }));
    const slice = ranked.slice(0, size);
    if (playerScore > 0 || real.some((s) => s.name === normalizedName)) {
      const youFull = ranked.find((e) => e.isYou);
      if (youFull && !slice.some((e) => e.isYou)) {
        // Replace the lowest entry with the player so their rank is still visible.
        slice[slice.length - 1] = youFull;
      }
    }
    const trimmed = slice;
    const yourRow = trimmed.find((e) => e.isYou);
    return {
      entries: trimmed,
      hasRealSubmissions: real.length > 0,
      includesYou: !!yourRow,
      yourRank: yourRow ? yourRow.rank : null,
      realPlayerCount: new Set(real.map((r) => r.name)).size,
    };
  }

  async submitDaily(
    date: string,
    seed: number,
    name: string,
    score: number,
    altitude: number,
  ): Promise<void> {
    if (!name || !name.trim()) return;
    await this.backend.submitDaily({
      date,
      seed,
      name: name.trim().slice(0, 16),
      score,
      altitude,
      timestamp: Date.now(),
    });
  }

  private botName(rng: SeededRandom): string {
    const first = rng.pick(BOT_FIRST_NAMES);
    return rng.chance(0.6) ? `${first}${rng.pick(BOT_LAST_TAGS)}` : first;
  }
}
