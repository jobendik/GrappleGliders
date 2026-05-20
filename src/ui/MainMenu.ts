import { GameMode, MODES } from '../game/GameState';
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

export class MainMenu {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(save: SaveSystem, daily: DailyChallengeSystem, cb: MainMenuCallbacks): void {
    this.close();
    const today = daily.today();
    const yesterdayEntry = save.data.dailyHistory.find((d) => d.date !== today.date);
    const yesterdayLine = yesterdayEntry
      ? `<div class="row" style="font-size:11px;color:var(--muted-soft);margin-top:6px;justify-content:flex-start;gap:6px"><span>Yesterday:</span><strong>${formatScore(yesterdayEntry.score)}</strong><span>· beat it?</span></div>`
      : '';
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const playLabel = save.data.settings.tutorialSeen ? 'Start Endless Climb' : 'Start Tutorial Run';
    const playerName = save.data.playerName?.trim() || 'Pilot';
    const nameBadge = save.data.playerNameSet
      ? `<button class="name-badge" data-el="name" title="Change name">👤 ${this.escapeHtml(playerName)}</button>`
      : `<button class="name-badge needs-name" data-el="name" title="Pick a name">👤 Set your name →</button>`;
    modal.innerHTML = `
      <div class="modal-content">
        <div class="hero">
          <div>
            <span class="eyebrow">Neon Synthwave Climber</span>
            <h1 class="title gradient-text">Grapple<br>Gliders</h1>
            <p class="subtitle">Fire your hook. Sling across the skyline. Outrun the rising lava — and chase a daily seed shared with every player on Earth.</p>
            <div class="hero-cta">
              <button class="primary large" data-el="play">${playLabel}</button>
              <button class="ghost" data-el="unlocks">Unlocks</button>
              ${nameBadge}
            </div>
          </div>
          <div class="hero-stats">
            <div class="hero-stat">
              <span class="label">Sparks</span>
              <div class="value accent" data-el="sparks">0</div>
            </div>
            <div class="hero-stat">
              <span class="label">Level</span>
              <div class="value" data-el="level">1</div>
            </div>
            <div class="hero-stat">
              <span class="label">Best Climb</span>
              <div class="value" data-el="best">0 m</div>
            </div>
            <div class="hero-stat">
              <span class="label">Streak</span>
              <div class="value" data-el="streak">0 d</div>
            </div>
          </div>
        </div>

        <div class="daily-strip">
          <div>
            <span class="label">Daily Challenge</span>
            <div class="info">New seeded run in <strong data-el="countdown">--:--:--</strong></div>
            ${yesterdayLine}
          </div>
          <button class="primary" data-el="daily">${daily.hasSubmittedToday() ? 'Replay (Practice)' : 'Play Daily'}</button>
        </div>

        <h3 class="section">Choose a Mode</h3>
        <div class="mode-grid" data-el="modes"></div>

        <div class="actions">
          <button class="ghost" data-el="leaderboard">Leaderboard</button>
          <button class="ghost" data-el="settings">Settings</button>
          ${save.data.settings.tutorialSeen ? '<button class="ghost" data-el="tutorial">Tutorial</button>' : ''}
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;

    modal.querySelector<HTMLElement>('[data-el="sparks"]')!.textContent =
      save.data.sparks.toLocaleString('en-US');
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
      card.style.setProperty('--mode-tint', meta.iconColor);
      card.innerHTML = `
        <h3>${meta.name}</h3>
        <p>${meta.tagline}</p>
        <div class="best">${this.bestSummary(save, mode)}</div>
      `;
      card.addEventListener('click', () => cb.onPlay(mode));
      modes.appendChild(card);
    });

    modal.querySelector('[data-el="play"]')!.addEventListener('click', () => {
      if (save.data.settings.tutorialSeen) cb.onPlay(GameMode.EndlessClimb);
      else cb.onTutorial();
    });
    modal
      .querySelector('[data-el="daily"]')!
      .addEventListener('click', () => cb.onPlay(GameMode.DailyChallenge));
    modal.querySelector('[data-el="unlocks"]')!.addEventListener('click', cb.onUnlocks);
    modal
      .querySelector('[data-el="leaderboard"]')!
      .addEventListener('click', () => cb.onLeaderboard(GameMode.DailyChallenge));
    modal.querySelector('[data-el="settings"]')!.addEventListener('click', cb.onSettings);
    modal.querySelector('[data-el="tutorial"]')?.addEventListener('click', cb.onTutorial);
    modal.querySelector('[data-el="name"]')?.addEventListener('click', () => cb.onSetName?.());

    const countdown = modal.querySelector<HTMLElement>('[data-el="countdown"]')!;
    const updateCountdown = (): void => {
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
        // Surface the player's best clear across all courses, plus how many of
        // the four they've placed any medal on. Makes the menu card hint at
        // the new depth without listing every course on the menu itself.
        let bestT = Infinity;
        let medalled = 0;
        for (const c of TIME_ATTACK_COURSES) {
          const key = `${GameMode.TimeAttack}:${c.id}`;
          const t = save.data.bestTime[key];
          if (typeof t === 'number') bestT = Math.min(bestT, t);
          if ((save.data.timeAttackMedals[key] ?? 'none') !== 'none') medalled += 1;
        }
        const total = TIME_ATTACK_COURSES.length;
        if (medalled === 0) return `${total} courses — No medal yet`;
        return `${medalled}/${total} courses · Best ${bestT.toFixed(2)} s`;
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
