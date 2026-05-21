import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnlockSystem } from '../src/systems/UnlockSystem';
import { SaveSystem } from '../src/systems/SaveSystem';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, v); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

const makeSave = (overrides: Partial<{ sparks: number; unlockedSkins: string[]; unlockedHooks: string[]; unlockedTrails: string[]; unlockedThemes: string[] }> = {}): SaveSystem => {
  const save = new SaveSystem();
  Object.assign(save.data, overrides);
  return save;
};

describe('UnlockSystem.nextCheapestUnlock', () => {
  it('returns the cheapest unowned cosmetic across all categories', () => {
    const save = makeSave({ sparks: 0 });
    const system = new UnlockSystem(save);
    const next = system.nextCheapestUnlock();
    expect(next).not.toBeNull();
    // Cheapest non-free cosmetics: sunburst/magenta skins (cost 250).
    expect(next!.cost).toBe(250);
    expect(['sunburst', 'magenta']).toContain(next!.id);
  });

  it('reports remaining sparks correctly when the player is partway there', () => {
    const save = makeSave({ sparks: 200 });
    const system = new UnlockSystem(save);
    const next = system.nextCheapestUnlock();
    expect(next).not.toBeNull();
    expect(next!.current).toBe(200);
    expect(next!.remaining).toBe(50);
  });

  it('skips already-owned cosmetics', () => {
    const save = makeSave({
      sparks: 0,
      // Pre-own the two 250-cost skins so the next pick advances to 300+ cost.
      unlockedSkins: ['neon-cyan', 'sunburst', 'magenta'],
    });
    const system = new UnlockSystem(save);
    const next = system.nextCheapestUnlock();
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe('sunburst');
    expect(next!.id).not.toBe('magenta');
    // Iron Chain hook costs 300, which is now the cheapest.
    expect(next!.cost).toBeGreaterThanOrEqual(300);
  });

  it('returns null when everything paid is already owned', () => {
    const save = makeSave({
      sparks: 0,
      unlockedSkins: [
        'neon-cyan', 'sunburst', 'magenta', 'jungle', 'cherry', 'frost',
        'void', 'gold', 'glitch', 'phoenix', 'oracle', 'apex',
      ],
      unlockedHooks: ['cable', 'chain', 'laser', 'vine', 'plasma', 'thread', 'lightning', 'silk'],
      unlockedTrails: [
        'cyan-streak', 'rainbow', 'fire', 'ghost', 'glitch', 'void',
        'circuit', 'aurora', 'cherry', 'gold', 'phoenix', 'apex',
      ],
      unlockedThemes: ['synthwave', 'vaporwave', 'cyber-noir', 'neon-jungle', 'blood-moon', 'ice-station', 'lunar-drift', 'molten-core'],
    });
    const system = new UnlockSystem(save);
    expect(system.nextCheapestUnlock()).toBeNull();
  });
});
