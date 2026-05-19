import type { SaveSystem, SaveSettings } from '../systems/SaveSystem';
import type { ToastManager } from './Toast';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Music } from '../audio/Music';
import { installPWA, uninstallPWA } from '../platform/PWA';

export interface SettingsCallbacks {
  onClose(): void;
  onTutorialReset(): void;
}

export class SettingsScreen {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(
    save: SaveSystem,
    audio: AudioEngine,
    music: Music,
    toast: ToastManager,
    cb: SettingsCallbacks,
  ): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="title gradient-text" style="font-size:clamp(28px,5vw,52px)">Settings</h1>
        <div class="stat-grid" data-el="toggles"></div>
        <div class="actions">
          <button class="ghost" data-el="export">Export Save</button>
          <button class="ghost" data-el="import">Import Save</button>
          <button class="ghost" data-el="reset">Reset Tutorial</button>
          <button class="ghost" data-el="pwa">Install PWA</button>
          <button class="ghost" data-el="back">Back</button>
        </div>
        <p class="subtitle" style="font-size:11px;margin-top:18px;color:rgba(234,255,255,0.45)">v1.0.0 · Built with TypeScript + Vite · Canvas 2D · No tracking</p>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;

    const toggles = modal.querySelector<HTMLElement>('[data-el="toggles"]')!;
    const settings = save.data.settings;
    const renderToggle = (
      label: string,
      key: keyof SaveSettings,
      onChange?: (v: boolean) => void,
    ) => {
      const card = document.createElement('div');
      card.className = 'stat';
      const initial = settings[key] as boolean;
      card.innerHTML = `
        <span class="label">${label}</span>
        <button class="toggle" aria-pressed="${initial}">${initial ? 'On' : 'Off'}</button>
      `;
      const btn = card.querySelector<HTMLButtonElement>('button')!;
      btn.addEventListener('click', () => {
        const next = !(settings[key] as boolean);
        (settings as unknown as Record<string, boolean>)[key as string] = next;
        btn.setAttribute('aria-pressed', String(next));
        btn.textContent = next ? 'On' : 'Off';
        save.save();
        onChange?.(next);
      });
      toggles.appendChild(card);
    };

    renderToggle('Sound', 'sound', (v) => audio.setEnabled('sfx', v));
    renderToggle('Music', 'music', (v) => {
      audio.setEnabled('music', v);
      if (!v) music.stop();
      else music.play(save.data.equippedTheme);
    });
    renderToggle('Haptics', 'haptics');
    renderToggle('Reduced Motion', 'reducedMotion');
    renderToggle('Show Ghost', 'showGhost');
    renderToggle('Tap Toggle Mode', 'tapToggle');

    modal.querySelector('[data-el="back"]')!.addEventListener('click', () => {
      this.close();
      cb.onClose();
    });
    modal.querySelector('[data-el="reset"]')!.addEventListener('click', () => {
      save.data.settings.tutorialSeen = false;
      save.save();
      cb.onTutorialReset();
      toast.show('Tutorial will play on next run.');
    });
    modal.querySelector('[data-el="export"]')!.addEventListener('click', () => {
      const json = save.exportJSON();
      void navigator.clipboard?.writeText(json).then(() => toast.show('Save copied to clipboard.'));
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grapple-gliders-save.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    modal.querySelector('[data-el="import"]')!.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const ok = save.importJSON(String(reader.result));
          toast.show(ok ? 'Save imported.' : 'Invalid save file.');
        };
        reader.readAsText(file);
      });
      input.click();
    });
    modal.querySelector('[data-el="pwa"]')!.addEventListener('click', async () => {
      const installed = await installPWA();
      toast.show(installed ? 'PWA installed.' : 'Install failed — try again from settings.');
      if (!installed) await uninstallPWA();
    });
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
