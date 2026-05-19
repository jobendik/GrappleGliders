import { ACHIEVEMENTS, type AchievementDef } from '../content/achievements';
import type { SaveSystem } from './SaveSystem';

export interface AchievementUnlock {
  def: AchievementDef;
}

export class AchievementSystem {
  constructor(private save: SaveSystem) {}

  private getOrCreate(id: string) {
    if (!this.save.data.achievements[id]) {
      this.save.data.achievements[id] = { unlocked: false, progress: 0 };
    }
    return this.save.data.achievements[id]!;
  }

  setProgress(id: string, value: number, onUnlock?: (a: AchievementUnlock) => void): void {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    const state = this.getOrCreate(id);
    if (state.unlocked) return;
    state.progress = Math.max(state.progress ?? 0, value);
    if (def.target && state.progress >= def.target) {
      this.unlock(id, onUnlock);
    }
  }

  unlock(id: string, onUnlock?: (a: AchievementUnlock) => void): void {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    const state = this.getOrCreate(id);
    if (state.unlocked) return;
    state.unlocked = true;
    state.unlockedAt = Date.now();
    if (def.reward) this.save.data.sparks += def.reward;
    this.save.save();
    onUnlock?.({ def });
  }

  isUnlocked(id: string): boolean {
    return this.save.data.achievements[id]?.unlocked === true;
  }
}
