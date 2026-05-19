import { SKINS } from '../content/skins';
import { HOOKS } from '../content/hooks';
import { TRAILS } from '../content/trails';
import { THEMES } from '../content/themes';
import type { UnlockKind, UnlockSystem } from '../systems/UnlockSystem';
import type { SaveSystem } from '../systems/SaveSystem';
import type { ToastManager } from './Toast';

export interface UnlocksCallbacks {
  onClose(): void;
}

export class UnlocksScreen {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private activeTab: UnlockKind = 'skin';

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(save: SaveSystem, unlocks: UnlockSystem, toast: ToastManager, cb: UnlocksCallbacks): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    const modal = document.createElement('div');
    modal.className = 'modal';
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
        </div>
        <div class="toolbar" data-el="tabs">
          <button class="tab active" data-tab="skin">Skins</button>
          <button class="tab" data-tab="hook">Hooks</button>
          <button class="tab" data-tab="trail">Trails</button>
          <button class="tab" data-tab="theme">Themes</button>
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
    const refreshSparks = () => {
      sparksEl.textContent = save.data.sparks.toLocaleString('en-US');
    };
    refreshSparks();

    const render = () => {
      grid.innerHTML = '';
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
            const result = unlocks.purchase(this.activeTab, entry.id);
            if (result.success) {
              toast.show(`Unlocked: ${entry.name}`);
              refreshSparks();
            } else if (result.reason === 'insufficient-sparks') {
              toast.show('Not enough Sparks.');
            }
          } else if (!equipped) {
            unlocks.equip(this.activeTab, entry.id);
            toast.show(`${entry.name} equipped.`);
          }
          render();
        });
        grid.appendChild(card);
      }
    };

    modal.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as UnlockKind;
        this.activeTab = tab;
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

  private isEquipped(save: SaveSystem, kind: UnlockKind, id: string): boolean {
    switch (kind) {
      case 'skin': return save.data.equippedSkin === id;
      case 'hook': return save.data.equippedHook === id;
      case 'trail': return save.data.equippedTrail === id;
      case 'theme': return save.data.equippedTheme === id;
    }
  }

  private previewHTML(kind: UnlockKind, id: string): string {
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
    const t = THEMES.find((x) => x.id === id)!;
    return `<div class="unlock-preview" style="background:linear-gradient(180deg, ${t.skyTop}, ${t.skyBottom});color:${t.accent};border:1px solid ${t.accent}"></div>`;
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
