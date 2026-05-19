import { GameMode, MODES } from '../game/GameState';
import { formatCountdown, formatScore } from '../utils/format';
import type { SaveSystem } from '../systems/SaveSystem';
import type { DailyChallengeSystem } from '../systems/DailyChallengeSystem';

export interface MainMenuCallbacks {
  onPlay(mode: GameMode): void;
  onUnlocks(): void;
  onSettings(): void;
  onLeaderboard(mode: GameMode): void;
  onTutorial(): void;
}

export class MainMenu {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(save: SaveSystem, daily: DailyChallengeSystem, cb: MainMenuCallbacks): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="title gradient-text">Grapple<br>Gliders</h1>
        <p class="subtitle">Tap and hold to fire your grappling hook. Release to fling. Outrun the rising lava. Climb forever.</p>
        <div class="stat-grid">
          <div class="stat"><span class="label">Sparks</span><div class="value" data-el="sparks">0</div></div>
          <div class="stat"><span class="label">Level</span><div class="value" data-el="level">1</div></div>
          <div class="stat"><span class="label">Best Climb</span><div class="value" data-el="best">0 m</div></div>
          <div class="stat"><span class="label">Streak</span><div class="value" data-el="streak">0 d</div></div>
        </div>
        <div class="mode-grid" data-el="modes"></div>
        <div class="stat" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div>
            <span class="label">Daily Challenge</span>
            <div style="font-size:14px;color:var(--muted)">New seeded run in <strong data-el="countdown">--:--:--</strong></div>
          </div>
          <button class="primary" data-el="daily">${daily.hasSubmittedToday() ? 'Replay (Practice)' : 'Play Daily'}</button>
        </div>
        <div class="actions">
          <button class="primary" data-el="play">Start Endless Climb</button>
          <button class="ghost" data-el="unlocks">Unlocks</button>
          <button class="ghost" data-el="leaderboard">Leaderboard</button>
          <button class="ghost" data-el="settings">Settings</button>
          ${save.data.settings.tutorialSeen ? '<button class="ghost" data-el="tutorial">Tutorial</button>' : ''}
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;

    const sparks = modal.querySelector<HTMLElement>('[data-el="sparks"]')!;
    sparks.textContent = save.data.sparks.toLocaleString('en-US');
    modal.querySelector<HTMLElement>('[data-el="level"]')!.textContent = String(save.data.level);
    modal.querySelector<HTMLElement>('[data-el="best"]')!.textContent = `${Math.floor(
      save.data.bestAltitude[GameMode.EndlessClimb] ?? 0,
    )} m`;
    modal.querySelector<HTMLElement>('[data-el="streak"]')!.textContent = `${save.data.dailyStreak} d`;

    const modes = modal.querySelector<HTMLElement>('[data-el="modes"]')!;
    (Object.values(GameMode) as GameMode[]).forEach((mode) => {
      const meta = MODES[mode];
      const card = document.createElement('button');
      card.className = 'mode-card';
      card.style.borderColor = `color-mix(in srgb, ${meta.iconColor} 40%, transparent)`;
      card.innerHTML = `
        <h3 style="color:${meta.iconColor}">${meta.name}</h3>
        <p>${meta.tagline}</p>
        <p style="margin-top:6px;color:var(--white);font-size:11px">${this.bestSummary(save, mode)}</p>
      `;
      card.addEventListener('click', () => cb.onPlay(mode));
      modes.appendChild(card);
    });

    modal.querySelector('[data-el="play"]')!.addEventListener('click', () =>
      cb.onPlay(GameMode.EndlessClimb),
    );
    modal.querySelector('[data-el="daily"]')!.addEventListener('click', () =>
      cb.onPlay(GameMode.DailyChallenge),
    );
    modal.querySelector('[data-el="unlocks"]')!.addEventListener('click', cb.onUnlocks);
    modal
      .querySelector('[data-el="leaderboard"]')!
      .addEventListener('click', () => cb.onLeaderboard(GameMode.DailyChallenge));
    modal.querySelector('[data-el="settings"]')!.addEventListener('click', cb.onSettings);
    modal.querySelector('[data-el="tutorial"]')?.addEventListener('click', cb.onTutorial);

    const countdown = modal.querySelector<HTMLElement>('[data-el="countdown"]')!;
    const updateCountdown = () => {
      countdown.textContent = formatCountdown(daily.millisecondsUntilNextUTC());
    };
    updateCountdown();
    this.countdownInterval = setInterval(updateCountdown, 1000);
  }

  private bestSummary(save: SaveSystem, mode: GameMode): string {
    switch (mode) {
      case GameMode.EndlessClimb:
        return `Best ${Math.floor(save.data.bestAltitude[mode] ?? 0)} m`;
      case GameMode.DailyChallenge:
        return `Today: ${formatScore(save.data.bestScore[mode] ?? 0)}`;
      case GameMode.TimeAttack: {
        const t = save.data.bestTime[mode];
        return t ? `Best ${t.toFixed(2)} s` : 'No record';
      }
      case GameMode.ComboRun:
        return `Best ${formatScore(save.data.bestScore[mode] ?? 0)}`;
      case GameMode.BotRace: {
        const wins = save.data.botRaceWins;
        const total = (wins['sparky'] ?? 0) + (wins['phase'] ?? 0) + (wins['apex'] ?? 0);
        return `Wins ${total}`;
      }
    }
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
