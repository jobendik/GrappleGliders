import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveSystem, defaultSave } from '../src/systems/SaveSystem';
import { ProgressionSystem, levelFromXP, xpForLevel } from '../src/systems/ProgressionSystem';
import { UnlockSystem } from '../src/systems/UnlockSystem';
import {
  LayeredLeaderboardBackend,
  LeaderboardSystem,
  LocalLeaderboardBackend,
  RemoteLeaderboardBackend,
  type LeaderboardBackend,
} from '../src/systems/LeaderboardSystem';
import type { LeaderboardSubmission } from '../src/systems/SaveSystem';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

beforeEach(() => {
  const mem = new MemoryStorage();
  vi.stubGlobal('localStorage', mem);
});

describe('SaveSystem', () => {
  it('starts with default save when localStorage is empty', () => {
    const sys = new SaveSystem();
    expect(sys.data.version).toBe(1);
    expect(sys.data.sparks).toBe(0);
    expect(sys.data.unlockedSkins).toContain('neon-cyan');
  });

  it('persists to localStorage on flush', () => {
    const sys = new SaveSystem();
    sys.data.sparks = 500;
    sys.save();
    sys.flush();
    const raw = localStorage.getItem('grapple-gliders.v1.save');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.sparks).toBe(500);
  });

  it('round-trips through export/import', () => {
    const sys = new SaveSystem();
    sys.data.sparks = 1234;
    sys.data.bestAltitude['endless'] = 4321;
    const exported = sys.exportJSON();
    const next = new SaveSystem();
    next.importJSON(exported);
    expect(next.data.sparks).toBe(1234);
    expect(next.data.bestAltitude['endless']).toBe(4321);
  });

  it('rejects malformed import payload', () => {
    const sys = new SaveSystem();
    expect(sys.importJSON('{not json')).toBe(false);
  });

  it('updates daily streak from prior day login', () => {
    // Pre-seed with yesterday's date.
    const today = new Date();
    today.setUTCDate(today.getUTCDate() - 1);
    const yKey = `${today.getUTCFullYear()}-${(today.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0')}-${today.getUTCDate().toString().padStart(2, '0')}`;
    const initial = defaultSave();
    initial.lastLoginDate = yKey;
    initial.dailyStreak = 4;
    localStorage.setItem('grapple-gliders.v1.save', JSON.stringify(initial));
    const sys = new SaveSystem();
    expect(sys.data.dailyStreak).toBe(5);
  });

  it('cloud sync preserves local-only mode keys (no data loss on first sync)', async () => {
    const sys = new SaveSystem();
    // Player played some local modes before signing into cloud.
    sys.data.bestAltitude['endless'] = 1234;
    sys.data.bestAltitude['combo-run'] = 999;
    sys.data.bestScore['endless'] = 5000;
    sys.data.bestTime['timeAttack:rookie'] = 80;
    sys.data.botRaceWins['sparky'] = 3;

    // Cloud has different keys (player used another device with different modes).
    const cloudSave = defaultSave();
    cloudSave.bestAltitude['bot-race'] = 3000;
    cloudSave.bestAltitude['endless'] = 1000; // lower than local
    cloudSave.bestScore['bot-race'] = 2222;
    cloudSave.bestTime['timeAttack:spire'] = 70;
    cloudSave.botRaceWins['phase'] = 5;
    cloudSave.timeAttackMedals['timeAttack:spire'] = 'silver';

    const cloud = {
      getItem: async (_k: string): Promise<string | null> =>
        JSON.stringify(cloudSave),
      setItem: async (_k: string, _v: string): Promise<void> => undefined,
    };
    sys.attachCloud(cloud);
    // attachCloud schedules sync — wait two microtask turns for it to resolve.
    await Promise.resolve();
    await Promise.resolve();

    // Local-only keys must survive.
    expect(sys.data.bestAltitude['combo-run']).toBe(999);
    expect(sys.data.bestTime['timeAttack:rookie']).toBe(80);
    expect(sys.data.botRaceWins['sparky']).toBe(3);
    // Cloud-only keys must be picked up.
    expect(sys.data.bestAltitude['bot-race']).toBe(3000);
    expect(sys.data.bestScore['bot-race']).toBe(2222);
    expect(sys.data.bestTime['timeAttack:spire']).toBe(70);
    expect(sys.data.botRaceWins['phase']).toBe(5);
    expect(sys.data.timeAttackMedals['timeAttack:spire']).toBe('silver');
    // Overlapping key: local max wins for altitudes/scores.
    expect(sys.data.bestAltitude['endless']).toBe(1234);
  });
});

describe('ProgressionSystem', () => {
  it('xp curve increases monotonically', () => {
    for (let l = 1; l < 20; l++) {
      expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    }
  });

  it('levelFromXP matches the inverse of xpForLevel', () => {
    for (let l = 1; l < 10; l++) {
      expect(levelFromXP(xpForLevel(l))).toBe(l);
      expect(levelFromXP(xpForLevel(l + 1) - 1)).toBe(l);
    }
  });

  it('awards XP and sparks and tracks level-ups', () => {
    const save = new SaveSystem();
    const prog = new ProgressionSystem(save);
    const rewards = prog.awardRun({
      altitude: 2000,
      score: 25000,
      bonusComboPeak: 6,
      perfectAnchors: 12,
      nearMisses: 30,
    });
    expect(rewards.xp).toBeGreaterThan(0);
    expect(rewards.sparks).toBeGreaterThan(0);
    expect(save.data.totalRuns).toBe(1);
    expect(save.data.xp).toBe(rewards.xp);
    expect(save.data.sparks).toBe(rewards.sparks + rewards.levelUps.reduce((acc, lvl) => acc + 50 * lvl, 0));
  });

  it('applies daily-first-run bonus only when flagged', () => {
    const save = new SaveSystem();
    const prog = new ProgressionSystem(save);
    const a = prog.awardRun({ altitude: 1000, score: 10000, bonusComboPeak: 3, perfectAnchors: 0, nearMisses: 0 });
    const saveB = new SaveSystem();
    const progB = new ProgressionSystem(saveB);
    const b = progB.awardRun({
      altitude: 1000,
      score: 10000,
      bonusComboPeak: 3,
      perfectAnchors: 0,
      nearMisses: 0,
      dailyFirstRun: true,
    });
    expect(b.xp).toBeGreaterThan(a.xp);
    expect(b.bonusXp).toBeGreaterThan(0);
  });
});

describe('UnlockSystem', () => {
  it('blocks purchase when sparks insufficient', () => {
    const save = new SaveSystem();
    const unlocks = new UnlockSystem(save);
    save.data.sparks = 0;
    const r = unlocks.purchase('skin', 'magenta');
    expect(r.success).toBe(false);
    expect(r.reason).toBe('insufficient-sparks');
  });

  it('purchases and equips when conditions are met', () => {
    const save = new SaveSystem();
    const unlocks = new UnlockSystem(save);
    save.data.sparks = 9999;
    const r = unlocks.purchase('skin', 'magenta');
    expect(r.success).toBe(true);
    expect(save.data.unlockedSkins).toContain('magenta');
    expect(unlocks.equip('skin', 'magenta')).toBe(true);
    expect(save.data.equippedSkin).toBe('magenta');
  });

  it('rejects equipping an unowned cosmetic', () => {
    const save = new SaveSystem();
    const unlocks = new UnlockSystem(save);
    expect(unlocks.equip('skin', 'phoenix')).toBe(false);
  });
});

describe('LeaderboardSystem', () => {
  it('generates a deterministic board of the requested size with the player ranked', async () => {
    const save = new SaveSystem();
    const sys = new LeaderboardSystem(new LocalLeaderboardBackend(save));
    const a = await sys.buildDailyBoard('2024-01-01', 12345, 5000, 'TESTER', 30);
    const b = await sys.buildDailyBoard('2024-01-01', 12345, 5000, 'TESTER', 30);
    expect(a.entries.length).toBe(30);
    expect(a.entries.map((e) => e.score)).toEqual(b.entries.map((e) => e.score));
    expect(a.entries.filter((e) => e.isYou)).toHaveLength(1);
  });

  it('places the player consistently based on their score', async () => {
    const save = new SaveSystem();
    const sys = new LeaderboardSystem(new LocalLeaderboardBackend(save));
    const low = await sys.buildDailyBoard('2024-01-02', 987, 50, 'TESTER', 60);
    const high = await sys.buildDailyBoard('2024-01-02', 987, 99_999_999, 'TESTER', 60);
    const lowRank = low.entries.find((e) => e.isYou)!.rank;
    const highRank = high.entries.find((e) => e.isYou)!.rank;
    expect(highRank).toBeLessThan(lowRank);
  });

  it('persists real submissions and surfaces them on the board', async () => {
    const save = new SaveSystem();
    const sys = new LeaderboardSystem(new LocalLeaderboardBackend(save));
    await sys.submitDaily('2024-03-01', 4242, 'ASTRA', 12000, 1200);
    await sys.submitDaily('2024-03-01', 4242, 'ZED', 8000, 800);
    const snapshot = await sys.buildDailyBoard('2024-03-01', 4242, 9999, 'ASTRA', 50);
    expect(snapshot.hasRealSubmissions).toBe(true);
    const myRow = snapshot.entries.find((e) => e.isYou);
    expect(myRow).toBeTruthy();
    // ASTRA already submitted 12000, which beats the 9999 in this build; the snapshot keeps the higher.
    expect(myRow!.score).toBeGreaterThanOrEqual(12000);
    // ZED appears as a real (non-bot) entry.
    const zed = snapshot.entries.find((e) => e.name === 'ZED');
    expect(zed?.isBot).toBe(false);
  });

  it('upgrades an existing submission only when the new score is higher', async () => {
    const save = new SaveSystem();
    const sys = new LeaderboardSystem(new LocalLeaderboardBackend(save));
    await sys.submitDaily('2024-04-01', 1, 'KAI', 1000, 100);
    await sys.submitDaily('2024-04-01', 1, 'KAI', 500, 50);
    await sys.submitDaily('2024-04-01', 1, 'KAI', 1500, 150);
    const kai = save.data.leaderboardSubmissions.filter((s) => s.name === 'KAI');
    expect(kai).toHaveLength(1);
    expect(kai[0]!.score).toBe(1500);
  });
});

describe('RemoteLeaderboardBackend', () => {
  it('GET /leaderboard/{date} sanitizes the wire payload', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify([
          { date: '2026-01-02', name: 'ASTRA', score: 9000, altitude: 900, seed: 1, timestamp: 100 },
          { date: '2026-01-02', name: '<script>', score: 'bad', altitude: 100, seed: 2, timestamp: 200 },
          'garbage',
          null,
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const backend = new RemoteLeaderboardBackend({ baseUrl: 'https://example.invalid' });
    const result = await backend.fetchDaily('2026-01-02', 50);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('ASTRA');
    const calls = fetchSpy.mock.calls as unknown as [string, RequestInit][];
    const calledUrl = calls[0]![0];
    expect(calledUrl).toContain('/leaderboard/2026-01-02');
    expect(calledUrl).toContain('limit=50');
    vi.unstubAllGlobals();
  });

  it('POST /leaderboard sends the submission as JSON with optional bearer auth', async () => {
    const fetchSpy = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const backend = new RemoteLeaderboardBackend({
      baseUrl: 'https://example.invalid',
      apiKey: 'topsecret',
    });
    await backend.submitDaily({
      date: '2026-01-02',
      seed: 1,
      name: 'ASTRA',
      score: 12000,
      altitude: 1200,
      timestamp: 1000,
    });
    const calls = fetchSpy.mock.calls as unknown as [string, RequestInit][];
    const [, init] = calls[0]!;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer topsecret');
    expect(JSON.parse(init.body as string)).toEqual({
      date: '2026-01-02',
      seed: 1,
      name: 'ASTRA',
      score: 12000,
      altitude: 1200,
      timestamp: 1000,
    });
    vi.unstubAllGlobals();
  });
});

describe('LayeredLeaderboardBackend', () => {
  it('returns remote entries augmented with local-only ones', async () => {
    const remoteRows: LeaderboardSubmission[] = [
      { date: '2026-01-03', name: 'APEX', score: 30000, altitude: 3000, seed: 0, timestamp: 1 },
      { date: '2026-01-03', name: 'NOVA', score: 20000, altitude: 2000, seed: 0, timestamp: 1 },
    ];
    const remote: LeaderboardBackend = {
      fetchDaily: vi.fn(async () => remoteRows),
      submitDaily: vi.fn(async () => undefined),
    };
    const save = new SaveSystem();
    const local = new LocalLeaderboardBackend(save);
    await local.submitDaily({
      date: '2026-01-03',
      name: 'YOU',
      score: 25000,
      altitude: 2500,
      seed: 0,
      timestamp: 2,
    });
    const layered = new LayeredLeaderboardBackend(remote, local);
    const list = await layered.fetchDaily('2026-01-03', 50);
    const names = list.map((s) => s.name);
    expect(names).toContain('APEX');
    expect(names).toContain('NOVA');
    expect(names).toContain('YOU');
  });

  it('falls back to local entries when the remote fetch fails', async () => {
    const remote: LeaderboardBackend = {
      fetchDaily: vi.fn(async () => {
        throw new Error('network');
      }),
      submitDaily: vi.fn(async () => undefined),
    };
    const save = new SaveSystem();
    const local = new LocalLeaderboardBackend(save);
    await local.submitDaily({
      date: '2026-01-04',
      name: 'SOLO',
      score: 5000,
      altitude: 500,
      seed: 0,
      timestamp: 1,
    });
    const layered = new LayeredLeaderboardBackend(remote, local);
    const list = await layered.fetchDaily('2026-01-04', 10);
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('SOLO');
  });

  it('persists locally even when the remote submit throws', async () => {
    const remote: LeaderboardBackend = {
      fetchDaily: vi.fn(async () => []),
      submitDaily: vi.fn(async () => {
        throw new Error('remote down');
      }),
    };
    const save = new SaveSystem();
    const local = new LocalLeaderboardBackend(save);
    const layered = new LayeredLeaderboardBackend(remote, local);
    await layered.submitDaily({
      date: '2026-01-05',
      name: 'OFFLINE',
      score: 7777,
      altitude: 777,
      seed: 0,
      timestamp: 1,
    });
    expect(save.data.leaderboardSubmissions.find((s) => s.name === 'OFFLINE')?.score).toBe(7777);
    expect(remote.submitDaily).toHaveBeenCalledOnce();
  });
});
