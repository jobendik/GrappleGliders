import { utcDateKey, utcSeedFromDate } from '../utils/format';
import { makeDailySeed } from '../utils/seededRandom';
import type { DailyHistoryEntry, SaveSystem } from './SaveSystem';

export interface DailyChallenge {
  date: string;
  seed: number;
}

export class DailyChallengeSystem {
  constructor(private save: SaveSystem) {}

  today(): DailyChallenge {
    const date = utcDateKey();
    const seed = makeDailySeed(utcSeedFromDate(), 'daily');
    return { date, seed };
  }

  hasSubmittedToday(): boolean {
    const today = this.today();
    return this.save.data.dailyHistory.some((d) => d.date === today.date && d.submitted);
  }

  hasAttemptedToday(): boolean {
    const today = this.today();
    return this.save.data.dailyHistory.some((d) => d.date === today.date);
  }

  recordRun(score: number, altitude: number, combo: number, submitted: boolean): void {
    const today = this.today();
    const existing = this.save.data.dailyHistory.find((d) => d.date === today.date);
    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        existing.altitude = altitude;
        existing.combo = combo;
      }
      if (submitted) existing.submitted = true;
    } else {
      const entry: DailyHistoryEntry = {
        date: today.date,
        seed: today.seed,
        score,
        altitude,
        combo,
        submitted,
      };
      this.save.data.dailyHistory.unshift(entry);
      this.save.data.dailyHistory = this.save.data.dailyHistory.slice(0, 30);
    }
    this.save.save();
  }

  millisecondsUntilNextUTC(): number {
    const now = new Date();
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );
    return next.getTime() - now.getTime();
  }
}
