import type { SaveSystem } from './SaveSystem';

/** XP required to reach level n. Quadratic curve so progression slows naturally. */
export const xpForLevel = (level: number): number => 100 * level * (level + 1);

export const levelFromXP = (xp: number): number => {
  let lvl = 1;
  while (xp >= xpForLevel(lvl + 1)) lvl += 1;
  return lvl;
};

export interface RunRewards {
  xp: number;
  sparks: number;
  bonusXp: number;
  levelUps: number[];
}

export class ProgressionSystem {
  constructor(private save: SaveSystem) {}

  /** Awards XP and sparks. Returns reward summary including any level-ups. */
  awardRun(params: {
    altitude: number;
    score: number;
    bonusComboPeak: number;
    perfectAnchors: number;
    nearMisses: number;
    dailyFirstRun?: boolean;
    completionBonus?: boolean;
  }): RunRewards {
    const altitudeXp = Math.floor(params.altitude / 5);
    const scoreXp = Math.floor(params.score / 25);
    const skillXp = params.bonusComboPeak * 5 + params.perfectAnchors * 2 + params.nearMisses;
    let xp = altitudeXp + scoreXp + skillXp + (params.completionBonus ? 100 : 0);
    let bonusXp = 0;
    if (params.dailyFirstRun) {
      bonusXp = Math.floor(xp * 0.5);
      xp += bonusXp;
    }
    const sparks =
      Math.floor(params.altitude / 50) + Math.floor(params.score / 200) + params.perfectAnchors;

    this.save.data.sparks += sparks;
    const oldLevel = this.save.data.level;
    this.save.data.xp += xp;
    const newLevel = levelFromXP(this.save.data.xp);
    const levelUps: number[] = [];
    if (newLevel > oldLevel) {
      for (let l = oldLevel + 1; l <= newLevel; l++) {
        levelUps.push(l);
        this.save.data.sparks += 50 * l;
      }
      this.save.data.level = newLevel;
    }
    this.save.data.totalRuns += 1;
    this.save.save();
    return { xp, sparks, bonusXp, levelUps };
  }

  currentLevelProgress(): { level: number; current: number; needed: number } {
    const level = this.save.data.level;
    const base = xpForLevel(level);
    const next = xpForLevel(level + 1);
    return {
      level,
      current: this.save.data.xp - base,
      needed: next - base,
    };
  }
}
