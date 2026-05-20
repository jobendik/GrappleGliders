import { SKINS } from '../content/skins';
import { HOOKS } from '../content/hooks';
import { TRAILS } from '../content/trails';
import { THEMES } from '../content/themes';
import { ACHIEVEMENTS } from '../content/achievements';
import type { UnlockKind, UnlockSystem } from '../systems/UnlockSystem';
import type { SaveSystem } from '../systems/SaveSystem';
import type { AchievementSystem } from '../systems/AchievementSystem';
import type { ToastManager } from './Toast';

export interface UnlocksCallbacks {
  onClose(): void;
}

type Tab = UnlockKind | 'achievement';

export class UnlocksScreen {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private activeTab: Tab = 'skin';

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(
    save: SaveSystem,
    unlocks: UnlockSystem,
    _achievements: AchievementSystem,
    toast: ToastManager,
    cb: UnlocksCallbacks,
  ): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const unlockedAchievements = ACHIEVEMENTS.filter(
      (a) => save.data.achievements[a.id]?.unlocked,
    ).length;
    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="title gradient-text" style="font-size:clamp(28px,5vw,52px)">Unlocks</h1>
        <p class="subtitle">Spend Sparks. Equip what you love. Everything is cosmetic — no pay-to-win.</p>
        <div class="stat-grid">
          <div class="stat"><span class="label">Sparks</span><div class="value" data-el="sparks">0</div></div>
          <div class="stat"><span class="label">Skins</span><div class="value">${save.data.unlockedSkins.length}/${SKINS.length}</div></div>
          <div class="stat"><span class="label">Hooks</span><div class="value">${save.data.unlockedHooks.length}/${HOOKS.length}</div></div>
          <div class="stat"><span class="label">Trails</span><div class="value">${save.data.unlockedTrails.length}/${TRAILS.length}</div></div>
          <div class="stat"><span class="label">Themes</span><div class="value">${save.data.unlockedThemes.length}/${THEMES.length}</div></div>
          <div class="stat"><span class="label">Achievements</span><div class="value">${unlockedAchievements}/${ACHIEVEMENTS.length}</div></div>
        </div>
        <div class="toolbar" data-el="tabs">
          <button class="tab active" data-tab="skin">Skins</button>
          <button class="tab" data-tab="hook">Hooks</button>
          <button class="tab" data-tab="trail">Trails</button>
          <button class="tab" data-tab="theme">Themes</button>
          <button class="tab" data-tab="achievement">Achievements</button>
        </div>
        <div class="unlock-grid" data-el="grid"></div>
        <div class="actions">
          <button class="ghost" data-el="back">Back</button>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;

    const sparksEl = modal.querySelector<HTMLElement>('[data-el="sparks"]')!;
    const grid = modal.querySelector<HTMLElement>('[data-el="grid"]')!;
    const refreshSparks = (): void => {
      sparksEl.textContent = save.data.sparks.toLocaleString('en-US');
    };
    refreshSparks();

    const render = (): void => {
      grid.innerHTML = '';
      if (this.activeTab === 'achievement') {
        grid.classList.add('achievement-grid');
        this.renderAchievements(grid, save);
        return;
      }
      grid.classList.remove('achievement-grid');
      const entries = unlocks.list(this.activeTab);
      for (const entry of entries) {
        const card = document.createElement('button');
        card.className = 'unlock-card';
        const equipped = this.isEquipped(save, this.activeTab, entry.id);
        if (entry.owned) card.classList.add('owned');
        if (equipped) card.classList.add('equipped');
        if (!entry.owned) card.classList.add('locked');
        card.innerHTML = `
          ${this.previewHTML(this.activeTab, entry.id)}
          <strong>${entry.name}</strong>
          <span>${entry.owned ? (equipped ? 'Equipped' : 'Tap to equip') : `${entry.cost} Sparks`}</span>
        `;
        card.addEventListener('click', () => {
          if (!entry.owned) {
            const result = unlocks.purchase(this.activeTab as UnlockKind, entry.id);
            if (result.success) {
              toast.show(`Unlocked: ${entry.name}`);
              refreshSparks();
            } else if (result.reason === 'insufficient-sparks') {
              toast.show('Not enough Sparks.');
            }
          } else if (!equipped) {
            unlocks.equip(this.activeTab as UnlockKind, entry.id);
            toast.show(`${entry.name} equipped.`);
          }
          render();
        });
        grid.appendChild(card);
      }
    };

    modal.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab as Tab;
        modal.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
    });
    modal.querySelector('[data-el="back"]')!.addEventListener('click', () => {
      this.close();
      cb.onClose();
    });
    render();
  }

  private renderAchievements(grid: HTMLElement, save: SaveSystem): void {
    const sorted = [...ACHIEVEMENTS].sort((a, b) => {
      const aUnlocked = save.data.achievements[a.id]?.unlocked ? 1 : 0;
      const bUnlocked = save.data.achievements[b.id]?.unlocked ? 1 : 0;
      if (aUnlocked !== bUnlocked) return bUnlocked - aUnlocked;
      return 0;
    });
    for (const def of sorted) {
      const state = save.data.achievements[def.id];
      const unlocked = !!state?.unlocked;
      const progress = state?.progress ?? 0;
      const target = def.target ?? 0;
      const showHidden = def.hidden && !unlocked;
      const card = document.createElement('div');
      card.className = `achievement-card${unlocked ? ' unlocked' : ''}${showHidden ? ' hidden-ach' : ''}`;
      const progressLine = target > 0
        ? `<div class="ach-progress"><div class="ach-bar"><i style="width:${Math.min(100, Math.floor((progress / target) * 100))}%"></i></div><span>${Math.min(progress, target)}/${target}</span></div>`
        : '';
      const desc = showHidden ? 'Hidden — unlock to reveal.' : this.escapeHtml(def.description);
      const name = showHidden ? '???' : this.escapeHtml(def.name);
      card.innerHTML = `
        <div class="ach-icon">${unlocked ? '★' : '○'}</div>
        <div class="ach-body">
          <strong>${name}</strong>
          <p>${desc}</p>
          ${progressLine}
        </div>
        <div class="ach-reward">+${def.reward} Sparks</div>
      `;
      grid.appendChild(card);
    }
    if (sorted.every((a) => !save.data.achievements[a.id]?.unlocked)) {
      const hint = document.createElement('div');
      hint.className = 'ach-empty';
      hint.textContent = 'Climb to unlock your first achievement.';
      grid.appendChild(hint);
    }
  }

  private isEquipped(save: SaveSystem, kind: Tab, id: string): boolean {
    switch (kind) {
      case 'skin': return save.data.equippedSkin === id;
      case 'hook': return save.data.equippedHook === id;
      case 'trail': return save.data.equippedTrail === id;
      case 'theme': return save.data.equippedTheme === id;
      case 'achievement': return false;
    }
  }

  private previewHTML(kind: Tab, id: string): string {
    if (kind === 'skin') {
      const s = SKINS.find((x) => x.id === id)!;
      return `<div class="unlock-preview" style="background:radial-gradient(circle, ${s.primary}, ${s.secondary});color:${s.glow}"></div>`;
    }
    if (kind === 'hook') {
      const h = HOOKS.find((x) => x.id === id)!;
      return `<div class="unlock-preview" style="background:#0a0e1c;color:${h.color};border:2px solid ${h.color}">⚓</div>`;
    }
    if (kind === 'trail') {
      const t = TRAILS.find((x) => x.id === id)!;
      const gradient = t.colors.map((c, i) => `${c} ${i * (100 / t.colors.length)}%`).join(', ');
      return `<div class="unlock-preview" style="background:linear-gradient(135deg, ${gradient});color:${t.colors[0]}"></div>`;
    }
    if (kind === 'theme') {
      const t = THEMES.find((x) => x.id === id)!;
      return `<div class="unlock-preview" style="background:linear-gradient(180deg, ${t.skyTop}, ${t.skyBottom});color:${t.accent};border:1px solid ${t.accent}"></div>`;
    }
    return '';
  }

  private escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
    );
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
