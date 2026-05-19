import { formatCountdown, formatScore } from '../utils/format';
import type { DailyChallengeSystem } from '../systems/DailyChallengeSystem';
import type { LeaderboardEntry } from '../systems/LeaderboardSystem';
import type { SaveSystem } from '../systems/SaveSystem';

export interface DailyCallbacks {
  onPlay(): void;
  onClose(): void;
}

export class DailyChallengeScreen {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(
    save: SaveSystem,
    daily: DailyChallengeSystem,
    leaderboard: LeaderboardEntry[],
    cb: DailyCallbacks,
  ): void {
    this.close();
    const today = daily.today();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const todayEntry = save.data.dailyHistory.find((d) => d.date === today.date);
    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="title gradient-text" style="font-size:clamp(28px,5vw,52px)">Daily Challenge</h1>
        <p class="subtitle">${today.date} · Seed ${today.seed.toString(16)} · Every player on Earth gets the same course.</p>
        <div class="stat-grid">
          <div class="stat"><span class="label">Your Best Today</span><div class="value">${formatScore(todayEntry?.score ?? 0)}</div></div>
          <div class="stat"><span class="label">Ranked</span><div class="value">${todayEntry?.submitted ? 'Submitted' : 'Not yet'}</div></div>
          <div class="stat"><span class="label">Next Daily</span><div class="value" data-el="countdown">--:--:--</div></div>
        </div>
        <div class="leaderboard">
          ${leaderboard
            .slice(0, 50)
            .map(
              (e) =>
                `<div class="row${e.isYou ? ' you' : ''}"><span>#${e.rank}</span><span>${e.name}</span><strong>${formatScore(e.score)}</strong></div>`,
            )
            .join('')}
        </div>
        <p class="subtitle" style="font-size:11px;margin-top:14px;color:rgba(234,255,255,0.45)">
          Leaderboard is generated locally with deterministic bots until a real backend is connected.
        </p>
        <div class="actions">
          <button class="primary" data-el="play">${todayEntry?.submitted ? 'Practice Run' : 'Play Ranked'}</button>
          <button class="ghost" data-el="back">Back</button>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;

    const countdown = modal.querySelector<HTMLElement>('[data-el="countdown"]')!;
    const tick = () => {
      countdown.textContent = formatCountdown(daily.millisecondsUntilNextUTC());
    };
    tick();
    this.interval = setInterval(tick, 1000);

    modal.querySelector('[data-el="play"]')!.addEventListener('click', () => {
      this.close();
      cb.onPlay();
    });
    modal.querySelector('[data-el="back"]')!.addEventListener('click', () => {
      this.close();
      cb.onClose();
    });
  }

  close(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
