import { SKINS, type SkinDef } from '../content/skins';
import { HOOKS, type HookDef } from '../content/hooks';
import { TRAILS, type TrailDef } from '../content/trails';
import { THEMES, type ThemeDef } from '../content/themes';
import type { SaveSystem } from './SaveSystem';

export type UnlockKind = 'skin' | 'hook' | 'trail' | 'theme';

export interface ShopEntry {
  kind: UnlockKind;
  id: string;
  name: string;
  cost: number;
  owned: boolean;
}

/** The next cheapest unlock the player is progressing toward. */
export interface NextUnlockPreview {
  kind: UnlockKind;
  id: string;
  name: string;
  cost: number;
  /** Player's current Sparks balance — caller pre-supplies for clarity. */
  current: number;
  /** Sparks remaining until purchase becomes possible (≥0). */
  remaining: number;
}

export interface PurchaseResult {
  success: boolean;
  reason?: 'insufficient-sparks' | 'already-owned' | 'unknown';
}

export class UnlockSystem {
  constructor(private save: SaveSystem) {}

  list(kind: UnlockKind): ShopEntry[] {
    const data = this.save.data;
    const map = {
      skin: { src: SKINS, owned: data.unlockedSkins },
      hook: { src: HOOKS, owned: data.unlockedHooks },
      trail: { src: TRAILS, owned: data.unlockedTrails },
      theme: { src: THEMES, owned: data.unlockedThemes },
    }[kind];
    return map.src.map((def) => ({
      kind,
      id: def.id,
      name: def.name,
      cost: def.cost,
      owned: map.owned.includes(def.id),
    }));
  }

  purchase(kind: UnlockKind, id: string): PurchaseResult {
    const lists = {
      skin: { src: SKINS as readonly (SkinDef | HookDef | TrailDef | ThemeDef)[], owned: this.save.data.unlockedSkins },
      hook: { src: HOOKS, owned: this.save.data.unlockedHooks },
      trail: { src: TRAILS, owned: this.save.data.unlockedTrails },
      theme: { src: THEMES, owned: this.save.data.unlockedThemes },
    }[kind];
    const def = lists.src.find((d) => d.id === id);
    if (!def) return { success: false, reason: 'unknown' };
    if (lists.owned.includes(id)) return { success: false, reason: 'already-owned' };
    if (this.save.data.sparks < def.cost)
      return { success: false, reason: 'insufficient-sparks' };
    this.save.data.sparks -= def.cost;
    lists.owned.push(id);
    this.save.save();
    return { success: true };
  }

  /**
   * Pick the cheapest unowned cosmetic across all categories so the end-of-run
   * screen can show "this run earned X / Y Sparks toward Z." Ties resolve in
   * the order: skin → hook → trail → theme. Returns null when everything is
   * already owned.
   */
  nextCheapestUnlock(): NextUnlockPreview | null {
    const data = this.save.data;
    type Pool = { kind: UnlockKind; defs: readonly { id: string; name: string; cost: number }[]; owned: string[] };
    const pools: Pool[] = [
      { kind: 'skin', defs: SKINS as readonly SkinDef[], owned: data.unlockedSkins },
      { kind: 'hook', defs: HOOKS as readonly HookDef[], owned: data.unlockedHooks },
      { kind: 'trail', defs: TRAILS as readonly TrailDef[], owned: data.unlockedTrails },
      { kind: 'theme', defs: THEMES as readonly ThemeDef[], owned: data.unlockedThemes },
    ];
    let best: NextUnlockPreview | null = null;
    for (const pool of pools) {
      for (const def of pool.defs) {
        if (pool.owned.includes(def.id)) continue;
        if (def.cost <= 0) continue;
        if (!best || def.cost < best.cost) {
          best = {
            kind: pool.kind,
            id: def.id,
            name: def.name,
            cost: def.cost,
            current: data.sparks,
            remaining: Math.max(0, def.cost - data.sparks),
          };
        }
      }
    }
    return best;
  }

  equip(kind: UnlockKind, id: string): boolean {
    const owned = {
      skin: this.save.data.unlockedSkins,
      hook: this.save.data.unlockedHooks,
      trail: this.save.data.unlockedTrails,
      theme: this.save.data.unlockedThemes,
    }[kind];
    if (!owned.includes(id)) return false;
    switch (kind) {
      case 'skin':
        this.save.data.equippedSkin = id;
        break;
      case 'hook':
        this.save.data.equippedHook = id;
        break;
      case 'trail':
        this.save.data.equippedTrail = id;
        break;
      case 'theme':
        this.save.data.equippedTheme = id;
        break;
    }
    this.save.save();
    return true;
  }
}
