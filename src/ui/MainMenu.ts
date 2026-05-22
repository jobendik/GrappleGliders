import { GameMode, MODES, TIME_ATTACK_ENABLED } from '../game/GameState';
import { formatCountdown, formatScore } from '../utils/format';
import type { SaveSystem } from '../systems/SaveSystem';
import type { DailyChallengeSystem } from '../systems/DailyChallengeSystem';
import { TIME_ATTACK_COURSES } from '../content/timeAttackCourses';

export interface MainMenuCallbacks {
  onPlay(mode: GameMode): void;
  onUnlocks(): void;
  onSettings(): void;
  onLeaderboard(mode: GameMode): void;
  onTutorial(): void;
  onSetName?: () => void;
}

const PILL_ORDER: GameMode[] = [
  GameMode.EndlessClimb,
  GameMode.DailyChallenge,
  // Time Attack is gated behind TIME_ATTACK_ENABLED for the launch — see
  // GameState.ts. The mode metadata, screen, and save fields are preserved
  // so flipping the flag re-enables the mode without migration.
  ...(TIME_ATTACK_ENABLED ? [GameMode.TimeAttack] : []),
  GameMode.ComboRun,
  GameMode.BotRace,
];

const PILL_LABEL: Record<GameMode, string> = {
  [GameMode.EndlessClimb]: 'Endless',
  [GameMode.DailyChallenge]: 'Daily',
  [GameMode.TimeAttack]: 'Time Attack',
  [GameMode.ComboRun]: 'Combo',
  [GameMode.BotRace]: 'Bot Race',
};

export class MainMenu {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private selectedMode: GameMode = GameMode.EndlessClimb;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(save: SaveSystem, daily: DailyChallengeSystem, cb: MainMenuCallbacks): void {
    this.close();
    const isFirstRun = !save.data.settings.tutorialSeen;
    this.selectedMode = GameMode.EndlessClimb;

    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    const modal = document.createElement('div');
    modal.className = 'modal menu-v2';

    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="title gradient-text menu-title">Grapple Gliders</h1>
        <div class="menu-subtitle">
          <strong>Swing, glide, and survive.</strong>
          <em>${isFirstRun ? 'New here? Press PLAY for a safe tutorial — no lava, no rush.' : 'Beat your best distance.'}</em>
        </div>

        <div class="menu-pills" role="tablist" data-el="pills"></div>

        <div class="menu-context">
          <p class="menu-tagline" data-el="tagline">—</p>
          <div class="menu-meta" data-el="meta">—</div>
        </div>

        <div class="menu-play-wrap">
          <button class="primary large menu-play" data-el="play">PLAY</button>
          <div class="menu-play-hint" data-el="hint"></div>
        </div>

        <div class="menu-identity" data-el="identity"></div>

        <div class="menu-icons">
          <button class="icon-btn" data-el="tutorial" title="Tutorial" aria-label="Tutorial"><span aria-hidden="true">🎓</span><em>Tutorial</em></button>
          <button class="icon-btn" data-el="leaderboard" title="Leaderboard" aria-label="Leaderboard"><span aria-hidden="true">🏆</span><em>Leaderboard</em></button>
          <button class="icon-btn" data-el="unlocks" title="Unlocks" aria-label="Unlocks"><span aria-hidden="true">✨</span><em>Unlocks</em></button>
          <button class="icon-btn" data-el="settings" title="Settings" aria-label="Settings"><span aria-hidden="true">⚙</span><em>Settings</em></button>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;

    const pills = modal.querySelector<HTMLElement>('[data-el="pills"]')!;
    PILL_ORDER.forEach((mode) => {
      const meta = MODES[mode];
      const pill = document.createElement('button');
      pill.className = 'menu-pill';
      pill.dataset.mode = mode;
      pill.style.setProperty('--pill-tint', meta.iconColor);
      pill.setAttribute('role', 'tab');
      const showDot = mode === GameMode.DailyChallenge && !daily.hasSubmittedToday();
      pill.innerHTML = `<span class="pill-label">${PILL_LABEL[mode]}</span>${showDot ? '<span class="pill-dot" title="New daily available"></span>' : ''}`;
      pill.addEventListener('click', () => {
        this.selectedMode = mode;
        this.refreshSelection(modal, save, daily);
      });
      pills.appendChild(pill);
    });

    this.renderIdentity(modal, save);

    modal.querySelector('[data-el="play"]')!.addEventListener('click', () => {
      if (isFirstRun) cb.onTutorial();
      else cb.onPlay(this.selectedMode);
    });
    modal.querySelector('[data-el="unlocks"]')!.addEventListener('click', cb.onUnlocks);
    modal.querySelector('[data-el="settings"]')!.addEventListener('click', cb.onSettings);
    modal.querySelector('[data-el="tutorial"]')!.addEventListener('click', cb.onTutorial);
    modal
      .querySelector('[data-el="leaderboard"]')!
      .addEventListener('click', () => cb.onLeaderboard(GameMode.DailyChallenge));
    modal
      .querySelector('[data-el="name"]')
      ?.addEventListener('click', () => cb.onSetName?.());

    this.refreshSelection(modal, save, daily);

    const tick = (): void => {
      if (!this.el) return;
      if (this.selectedMode === GameMode.DailyChallenge) {
        const meta = modal.querySelector<HTMLElement>('[data-el="meta"]');
        if (meta) meta.innerHTML = this.dailyMeta(save, daily);
      }
    };
    tick();
    this.countdownInterval = setInterval(tick, 1000);
  }

  private renderIdentity(modal: HTMLElement, save: SaveSystem): void {
    const identity = modal.querySelector<HTMLElement>('[data-el="identity"]')!;
    const playerName = save.data.playerName?.trim() || 'Pilot';
    const nameClass = save.data.playerNameSet ? 'name-link' : 'name-link needs-name';
    const nameLabel = save.data.playerNameSet
      ? `👤 ${this.escapeHtml(playerName)}`
      : '👤 Pick a name';
    identity.innerHTML = `
      <button class="${nameClass}" data-el="name" title="Change name">${nameLabel}</button>
      <span class="identity-sep">·</span>
      <span class="identity-stat">✨ <strong>${save.data.sparks.toLocaleString('en-US')}</strong></span>
      <span class="identity-sep">·</span>
      <span class="identity-stat">LV <strong>${save.data.level}</strong></span>
      <span class="identity-sep">·</span>
      <span class="identity-stat">🔥 <strong>${save.data.dailyStreak}d</strong></span>
    `;
  }

  private refreshSelection(
    modal: HTMLElement,
    save: SaveSystem,
    daily: DailyChallengeSystem,
  ): void {
    const mode = this.selectedMode;
    const isFirstRun = !save.data.settings.tutorialSeen;
    const meta = MODES[mode];

    modal.querySelectorAll<HTMLElement>('.menu-pill').forEach((p) => {
      const active = p.dataset.mode === mode;
      p.classList.toggle('active', active);
      p.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    modal.querySelector<HTMLElement>('[data-el="tagline"]')!.textContent = meta.tagline;
    modal.querySelector<HTMLElement>('[data-el="meta"]')!.innerHTML =
      mode === GameMode.DailyChallenge
        ? this.dailyMeta(save, daily)
        : this.bestSummary(save, mode);

    modal.style.setProperty('--menu-accent', meta.iconColor);

    const play = modal.querySelector<HTMLButtonElement>('[data-el="play"]')!;
    const hint = modal.querySelector<HTMLElement>('[data-el="hint"]')!;
    if (isFirstRun) {
      play.textContent = 'PLAY';
      hint.textContent = 'Tutorial plays the first time — skippable, totally safe.';
    } else if (mode === GameMode.DailyChallenge && daily.hasSubmittedToday()) {
      play.textContent = 'REPLAY (PRACTICE)';
      hint.textContent = 'Ranked attempt already submitted.';
    } else if (mode === GameMode.TimeAttack) {
      play.textContent = 'PICK COURSE';
      hint.textContent = '';
    } else {
      play.textContent = 'PLAY';
      hint.textContent = '';
    }
  }

  private dailyMeta(save: SaveSystem, daily: DailyChallengeSystem): string {
    const cd = formatCountdown(daily.millisecondsUntilNextUTC());
    const todayBest = save.data.bestScore[GameMode.DailyChallenge] ?? 0;
    const lead = daily.hasSubmittedToday()
      ? `Today's run <strong>${formatScore(todayBest)}</strong>`
      : `<strong>New run available</strong>`;
    return `${lead} · Resets in <strong>${cd}</strong>`;
  }

  private bestSummary(save: SaveSystem, mode: GameMode): string {
    switch (mode) {
      case GameMode.EndlessClimb:
        return `Best <strong>${Math.floor(save.data.bestAltitude[mode] ?? 0)} m</strong>`;
      case GameMode.DailyChallenge:
        return `Best <strong>${formatScore(save.data.bestScore[mode] ?? 0)}</strong>`;
      case GameMode.TimeAttack: {
        let bestT = Infinity;
        let medalled = 0;
        for (const c of TIME_ATTACK_COURSES) {
          const key = `${GameMode.TimeAttack}:${c.id}`;
          const t = save.data.bestTime[key];
          if (typeof t === 'number') bestT = Math.min(bestT, t);
          if ((save.data.timeAttackMedals[key] ?? 'none') !== 'none') medalled += 1;
        }
        const total = TIME_ATTACK_COURSES.length;
        if (medalled === 0) return `<strong>${total} courses</strong> · No medal yet`;
        return `<strong>${medalled}/${total} courses</strong> · Best ${bestT.toFixed(2)} s`;
      }
      case GameMode.ComboRun:
        return `Best <strong>${formatScore(save.data.bestScore[mode] ?? 0)}</strong>`;
      case GameMode.BotRace: {
        const wins = save.data.botRaceWins;
        const total = (wins['sparky'] ?? 0) + (wins['phase'] ?? 0) + (wins['apex'] ?? 0);
        return `Wins <strong>${total}</strong>`;
      }
    }
  }

  private escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
    );
  }

  close(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = null;
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
