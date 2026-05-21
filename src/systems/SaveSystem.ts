import { utcDateKey } from '../utils/format';

export interface SaveSettings {
  /** Master SFX enabled toggle. */
  sound: boolean;
  /** Master music enabled toggle. */
  music: boolean;
  /** 0..1 — SFX bus volume. */
  sfxVolume: number;
  /** 0..1 — music bus volume. */
  musicVolume: number;
  haptics: boolean;
  tutorialSeen: boolean;
  showGhost: boolean;
  reducedMotion: boolean;
  quality: 'auto' | 'high' | 'low';
  tapToggle: boolean;
  /** Show on-screen left/right arrows on mobile in addition to the dash button. */
  mobileSteering: boolean;
  /**
   * Aim assist: snap touch / mouse aim to the nearest grappleable obstacle
   * within a generous radius. Hugely improves mobile playability without
   * removing skill expression; defaults on but can be turned off by
   * precision-aim purists.
   */
  aimAssist: boolean;
}

export interface DailyHistoryEntry {
  date: string;
  seed: number;
  score: number;
  altitude: number;
  combo: number;
  submitted: boolean;
}

export interface AchievementProgress {
  unlocked: boolean;
  unlockedAt?: number;
  progress?: number;
}

/** A real human player's submitted score, used by the cross-session leaderboard. */
export interface LeaderboardSubmission {
  /** YYYY-MM-DD UTC date of the daily challenge this score was set against. */
  date: string;
  seed: number;
  name: string;
  score: number;
  altitude: number;
  timestamp: number;
}

export interface SaveData {
  version: number;
  totalRuns: number;
  bestAltitude: Record<string, number>; // keyed by GameMode id
  bestScore: Record<string, number>;
  bestTime: Record<string, number>; // for Time Attack
  unlockedSkins: string[];
  unlockedHooks: string[];
  unlockedTrails: string[];
  unlockedThemes: string[];
  equippedSkin: string;
  equippedHook: string;
  equippedTrail: string;
  equippedTheme: string;
  sparks: number;
  xp: number;
  level: number;
  achievements: Record<string, AchievementProgress>;
  dailyStreak: number;
  lastLoginDate: string;
  dailyHistory: DailyHistoryEntry[];
  settings: SaveSettings;
  /** Ghost frames recorded for the latest endless personal best. */
  personalBestGhost: number[] | null;
  botRaceWins: Record<string, number>;
  timeAttackMedals: Record<string, 'none' | 'bronze' | 'silver' | 'gold'>;
  /** Display name for leaderboards. Empty string until the player picks one or CrazyGames SDK provides one. */
  playerName: string;
  /** True once the player has either set a name or accepted the default. Suppresses repeat prompts. */
  playerNameSet: boolean;
  /** Persistent local leaderboard submissions keyed by daily date. Kept small (per-day cap of 50). */
  leaderboardSubmissions: LeaderboardSubmission[];
}

const SAVE_KEY = 'grapple-gliders.v1.save';
const SAVE_VERSION = 1;

const defaultSettings: SaveSettings = {
  sound: true,
  music: true,
  sfxVolume: 0.5,
  musicVolume: 1.0,
  haptics: true,
  tutorialSeen: false,
  showGhost: true,
  reducedMotion: false,
  quality: 'auto',
  tapToggle: false,
  mobileSteering: true,
  aimAssist: true,
};

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  totalRuns: 0,
  bestAltitude: {},
  bestScore: {},
  bestTime: {},
  unlockedSkins: ['neon-cyan'],
  unlockedHooks: ['cable'],
  unlockedTrails: ['cyan-streak'],
  unlockedThemes: ['synthwave'],
  equippedSkin: 'neon-cyan',
  equippedHook: 'cable',
  equippedTrail: 'cyan-streak',
  equippedTheme: 'synthwave',
  sparks: 0,
  xp: 0,
  level: 1,
  achievements: {},
  dailyStreak: 0,
  lastLoginDate: '',
  dailyHistory: [],
  settings: { ...defaultSettings },
  personalBestGhost: null,
  botRaceWins: {},
  timeAttackMedals: {},
  playerName: '',
  playerNameSet: false,
  leaderboardSubmissions: [],
});

type CloudAdapter = {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
};

export class SaveSystem {
  data: SaveData;
  private cloud: CloudAdapter | null = null;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private onCloudSync?: () => void;

  constructor() {
    this.data = this.load();
    this.tickLoginStreak();
  }

  attachCloud(adapter: CloudAdapter, onSync?: () => void): void {
    this.cloud = adapter;
    if (onSync) this.onCloudSync = onSync;
    void this.syncFromCloud();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw) as SaveData;
      return this.migrate(parsed);
    } catch (err) {
      console.warn('Save load failed, starting fresh.', err);
      return defaultSave();
    }
  }

  private migrate(data: SaveData): SaveData {
    const base = defaultSave();
    const merged: SaveData = { ...base, ...data };
    merged.settings = { ...base.settings, ...(data.settings ?? {}) };
    merged.version = SAVE_VERSION;
    // Time Attack records moved from a single key ('timeAttack') to a per-course
    // key ('timeAttack:<id>') in May 2026. Map any legacy record onto the
    // 'rookie' course so existing players keep their best time + medal.
    const LEGACY_KEY = 'timeAttack';
    const ROOKIE_KEY = 'timeAttack:rookie';
    if (
      merged.bestTime &&
      merged.bestTime[LEGACY_KEY] !== undefined &&
      merged.bestTime[ROOKIE_KEY] === undefined
    ) {
      merged.bestTime = { ...merged.bestTime, [ROOKIE_KEY]: merged.bestTime[LEGACY_KEY]! };
      delete merged.bestTime[LEGACY_KEY];
    }
    if (
      merged.timeAttackMedals &&
      merged.timeAttackMedals[LEGACY_KEY] !== undefined &&
      merged.timeAttackMedals[ROOKIE_KEY] === undefined
    ) {
      merged.timeAttackMedals = {
        ...merged.timeAttackMedals,
        [ROOKIE_KEY]: merged.timeAttackMedals[LEGACY_KEY]!,
      };
      delete merged.timeAttackMedals[LEGACY_KEY];
    }
    return merged;
  }

  save(): void {
    this.dirty = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), 500);
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('Save write failed.', err);
    }
    if (this.cloud?.setItem) {
      // Defensive: a non-conforming cloud adapter could return undefined
      // (we've seen it happen with stub/dev implementations of setItem).
      // Wrap with Promise.resolve so .then never crashes the run.
      void Promise.resolve(this.cloud.setItem(SAVE_KEY, JSON.stringify(this.data)))
        .then(() => this.onCloudSync?.())
        .catch(() => undefined);
    }
  }

  private async syncFromCloud(): Promise<void> {
    if (!this.cloud) return;
    try {
      const raw = await this.cloud.getItem(SAVE_KEY);
      if (!raw) return;
      const cloud = JSON.parse(raw) as SaveData;
      // Naive merge: cloud wins on numeric maxes, local wins on most-recent timestamps.
      const merged = this.migrate(cloud);
      // Union local + cloud keys before taking the per-key max — otherwise a
      // local-only mode key (e.g. one the player only used offline) would be
      // dropped when `this.data = merged` assigns below.
      const altKeys = new Set([
        ...Object.keys(merged.bestAltitude),
        ...Object.keys(this.data.bestAltitude),
      ]);
      for (const k of altKeys) {
        merged.bestAltitude[k] = Math.max(
          merged.bestAltitude[k] ?? 0,
          this.data.bestAltitude[k] ?? 0,
        );
      }
      const scoreKeys = new Set([
        ...Object.keys(merged.bestScore),
        ...Object.keys(this.data.bestScore),
      ]);
      for (const k of scoreKeys) {
        merged.bestScore[k] = Math.max(merged.bestScore[k] ?? 0, this.data.bestScore[k] ?? 0);
      }
      // Also union bestTime (Time Attack per-course records) and timeAttackMedals.
      const timeKeys = new Set([
        ...Object.keys(merged.bestTime ?? {}),
        ...Object.keys(this.data.bestTime ?? {}),
      ]);
      for (const k of timeKeys) {
        const localT = this.data.bestTime[k];
        const cloudT = merged.bestTime[k];
        if (localT === undefined) {
          if (cloudT !== undefined) merged.bestTime[k] = cloudT;
        } else if (cloudT === undefined) {
          merged.bestTime[k] = localT;
        } else {
          merged.bestTime[k] = Math.min(localT, cloudT);
        }
      }
      const medalRank = { none: 0, bronze: 1, silver: 2, gold: 3 } as const;
      const medalKeys = new Set([
        ...Object.keys(merged.timeAttackMedals ?? {}),
        ...Object.keys(this.data.timeAttackMedals ?? {}),
      ]);
      for (const k of medalKeys) {
        const localM = this.data.timeAttackMedals[k] ?? 'none';
        const cloudM = merged.timeAttackMedals[k] ?? 'none';
        merged.timeAttackMedals[k] = medalRank[localM] >= medalRank[cloudM] ? localM : cloudM;
      }
      // Bot race wins: take the max per bot id.
      const winKeys = new Set([
        ...Object.keys(merged.botRaceWins ?? {}),
        ...Object.keys(this.data.botRaceWins ?? {}),
      ]);
      for (const k of winKeys) {
        merged.botRaceWins[k] = Math.max(
          merged.botRaceWins[k] ?? 0,
          this.data.botRaceWins[k] ?? 0,
        );
      }
      merged.sparks = Math.max(merged.sparks, this.data.sparks);
      merged.xp = Math.max(merged.xp, this.data.xp);
      merged.level = Math.max(merged.level, this.data.level);
      // Unions for unlocks
      merged.unlockedSkins = Array.from(new Set([...merged.unlockedSkins, ...this.data.unlockedSkins]));
      merged.unlockedHooks = Array.from(new Set([...merged.unlockedHooks, ...this.data.unlockedHooks]));
      merged.unlockedTrails = Array.from(new Set([...merged.unlockedTrails, ...this.data.unlockedTrails]));
      merged.unlockedThemes = Array.from(new Set([...merged.unlockedThemes, ...this.data.unlockedThemes]));
      // Player name: cloud wins if local hasn't been explicitly set.
      if (!this.data.playerNameSet && merged.playerNameSet) {
        // already from cloud
      } else if (this.data.playerNameSet && !merged.playerNameSet) {
        merged.playerName = this.data.playerName;
        merged.playerNameSet = true;
      }
      // Leaderboard submissions: union by timestamp+name, keep newest 200.
      const allSubmissions = [
        ...merged.leaderboardSubmissions,
        ...this.data.leaderboardSubmissions,
      ];
      const seen = new Set<string>();
      merged.leaderboardSubmissions = allSubmissions
        .filter((s) => {
          const key = `${s.date}|${s.name}|${s.score}|${s.timestamp}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 200);
      this.data = merged;
      this.onCloudSync?.();
      this.save();
    } catch (err) {
      console.warn('Cloud sync failed', err);
    }
  }

  private tickLoginStreak(): void {
    const today = utcDateKey();
    if (this.data.lastLoginDate === today) return;
    if (this.data.lastLoginDate) {
      const last = new Date(this.data.lastLoginDate + 'T00:00:00Z');
      const now = new Date(today + 'T00:00:00Z');
      const diffDays = Math.round((now.getTime() - last.getTime()) / 86400000);
      this.data.dailyStreak = diffDays === 1 ? this.data.dailyStreak + 1 : 1;
    } else {
      this.data.dailyStreak = 1;
    }
    this.data.lastLoginDate = today;
    this.save();
  }

  exportJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importJSON(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw) as SaveData;
      this.data = this.migrate(parsed);
      this.save();
      this.flush();
      return true;
    } catch {
      return false;
    }
  }

  resetAll(): void {
    this.data = defaultSave();
    this.save();
    this.flush();
  }
}
