import type { SaveSystem, SaveSettings } from '../systems/SaveSystem';
import type { ToastManager } from './Toast';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Music } from '../audio/Music';

export interface SettingsCallbacks {
  onClose(): void;
  onTutorialReset(): void;
  onNameChange?: (name: string) => void;
}

type BooleanSetting = {
  [K in keyof SaveSettings]: SaveSettings[K] extends boolean ? K : never;
}[keyof SaveSettings];

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

        <h3 class="section">Player</h3>
        <div class="settings-row">
          <label class="label" for="player-name-input">Display Name</label>
          <div class="name-input-row">
            <input id="player-name-input" type="text" maxlength="16" class="name-input" data-el="name" placeholder="Pick a name" />
            <button class="ghost" data-el="save-name">Save</button>
          </div>
          <p class="hint">Shown on the daily leaderboard and Bot Race. 1–16 characters.</p>
        </div>

        <h3 class="section">Audio</h3>
        <div class="settings-row">
          <div class="slider-card">
            <div class="slider-head"><span class="label">Music</span><span class="value" data-el="music-val">50%</span></div>
            <input type="range" min="0" max="100" step="1" data-el="music-vol" />
            <button class="toggle" data-el="music-toggle" aria-pressed="true">On</button>
          </div>
          <div class="slider-card">
            <div class="slider-head"><span class="label">Sound FX</span><span class="value" data-el="sfx-val">90%</span></div>
            <input type="range" min="0" max="100" step="1" data-el="sfx-vol" />
            <button class="toggle" data-el="sfx-toggle" aria-pressed="true">On</button>
          </div>
        </div>

        <h3 class="section">Gameplay</h3>
        <div class="stat-grid" data-el="toggles"></div>

        <div class="actions">
          <button class="ghost" data-el="export">Export Save</button>
          <button class="ghost" data-el="import">Import Save</button>
          <button class="ghost" data-el="reset">Reset Tutorial</button>
          <button class="ghost" data-el="back">Back</button>
        </div>
        <p class="subtitle" style="font-size:11px;margin-top:18px;color:rgba(234,255,255,0.45)">v1.0.0 · Built with TypeScript + Vite · Canvas 2D · No tracking</p>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;

    const settings = save.data.settings;

    // Name input
    const nameInput = modal.querySelector<HTMLInputElement>('[data-el="name"]')!;
    const saveNameBtn = modal.querySelector<HTMLButtonElement>('[data-el="save-name"]')!;
    nameInput.value = save.data.playerName ?? '';
    const commitName = (): void => {
      const next = nameInput.value.replace(/[^\p{L}\p{N}_\-. ]/gu, '').trim().slice(0, 16);
      nameInput.value = next;
      const prev = save.data.playerName;
      save.data.playerName = next;
      save.data.playerNameSet = next.length > 0;
      save.save();
      if (prev !== next) {
        cb.onNameChange?.(next);
        toast.show(next ? `Name set to ${next}.` : 'Name cleared.');
      }
    };
    saveNameBtn.addEventListener('click', commitName);
    nameInput.addEventListener('blur', commitName);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitName();
        nameInput.blur();
      }
    });

    // Music
    const musicVol = modal.querySelector<HTMLInputElement>('[data-el="music-vol"]')!;
    const musicVal = modal.querySelector<HTMLElement>('[data-el="music-val"]')!;
    const musicToggle = modal.querySelector<HTMLButtonElement>('[data-el="music-toggle"]')!;
    musicVol.value = String(Math.round(settings.musicVolume * 100));
    musicVal.textContent = `${musicVol.value}%`;
    musicToggle.setAttribute('aria-pressed', String(settings.music));
    musicToggle.textContent = settings.music ? 'On' : 'Off';
    musicVol.addEventListener('input', () => {
      const v = Number(musicVol.value) / 100;
      settings.musicVolume = v;
      musicVal.textContent = `${musicVol.value}%`;
      if (settings.music) audio.setVolume('music', v);
      save.save();
    });
    musicToggle.addEventListener('click', () => {
      const next = !settings.music;
      settings.music = next;
      musicToggle.setAttribute('aria-pressed', String(next));
      musicToggle.textContent = next ? 'On' : 'Off';
      audio.setEnabled('music', next);
      if (!next) music.stop();
      // Re-enable from Settings most often happens on the menu — play the
      // lobby loop. If a player toggles music mid-game during pause they'll
      // hear lobby briefly; the gameplay loop resumes on next run start.
      else music.playMenu();
      save.save();
    });

    // SFX
    const sfxVol = modal.querySelector<HTMLInputElement>('[data-el="sfx-vol"]')!;
    const sfxVal = modal.querySelector<HTMLElement>('[data-el="sfx-val"]')!;
    const sfxToggle = modal.querySelector<HTMLButtonElement>('[data-el="sfx-toggle"]')!;
    sfxVol.value = String(Math.round(settings.sfxVolume * 100));
    sfxVal.textContent = `${sfxVol.value}%`;
    sfxToggle.setAttribute('aria-pressed', String(settings.sound));
    sfxToggle.textContent = settings.sound ? 'On' : 'Off';
    sfxVol.addEventListener('input', () => {
      const v = Number(sfxVol.value) / 100;
      settings.sfxVolume = v;
      sfxVal.textContent = `${sfxVol.value}%`;
      if (settings.sound) audio.setVolume('sfx', v);
      save.save();
    });
    sfxToggle.addEventListener('click', () => {
      const next = !settings.sound;
      settings.sound = next;
      sfxToggle.setAttribute('aria-pressed', String(next));
      sfxToggle.textContent = next ? 'On' : 'Off';
      audio.setEnabled('sfx', next);
      save.save();
    });

    // Gameplay toggles
    const toggles = modal.querySelector<HTMLElement>('[data-el="toggles"]')!;
    const renderToggle = (
      label: string,
      key: BooleanSetting,
      onChange?: (v: boolean) => void,
    ): void => {
      const card = document.createElement('div');
      card.className = 'stat';
      const initial = settings[key];
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

    renderToggle('Haptics', 'haptics');
    renderToggle('Reduced Motion', 'reducedMotion');
    renderToggle('Show Ghost', 'showGhost');
    renderToggle('Tap Toggle Mode', 'tapToggle');
    renderToggle('Mobile Steering', 'mobileSteering');

    modal.querySelector('[data-el="back"]')!.addEventListener('click', () => {
      commitName();
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
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
