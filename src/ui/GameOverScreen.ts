import { GameMode } from '../game/GameState';
import { formatAltitude, formatScore, formatTime } from '../utils/format';
import type { RunRewards } from '../systems/ProgressionSystem';

export interface RacePodiumEntry {
  position: number;
  name: string;
  color: string;
  altitude: number;
  isYou: boolean;
  finished: boolean;
  finishTime: number | null;
}

export interface GameOverContext {
  mode: GameMode;
  cause: string;
  score: number;
  altitude: number;
  peakCombo: number;
  perfectAnchors: number;
  nearMisses: number;
  newBestAltitude: boolean;
  newBestScore: boolean;
  newBestTime: boolean;
  elapsedSeconds: number;
  rewards: RunRewards;
  raceResult?: { position: number; total: number };
  racePodium?: RacePodiumEntry[];
  canRevive: boolean;
  /** Whether the CrazyGames SDK is available — gates rewarded-ad buttons. */
  adsAvailable: boolean;
  /** Current daily-login streak in days. */
  dailyStreak: number;
}

export interface GameOverCallbacks {
  onRetry(): void;
  onRevive(): void;
  onMenu(): void;
  onWatch2xAd(): void;
}

export class GameOverScreen {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(ctx: GameOverContext, cb: GameOverCallbacks): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    // Tap anywhere on the dimmed background to retry — biggest mobile flow win.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
        cb.onRetry();
      }
    });
    const modal = document.createElement('div');
    modal.className = 'modal';
    const showRevive = ctx.canRevive && ctx.adsAvailable;
    const show2x = ctx.adsAvailable;
    const streakNudge = this.streakNudge(ctx.dailyStreak);
    const podiumHtml = ctx.racePodium ? this.renderPodium(ctx.racePodium) : '';
    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="title gradient-text">Run Ended</h1>
        <p class="subtitle">${ctx.cause}</p>
        ${podiumHtml}
        <div class="stat-grid">
          <div class="stat"><span class="label">Score</span><div class="value">${formatScore(ctx.score)}</div></div>
          <div class="stat"><span class="label">Altitude</span><div class="value">${formatAltitude(ctx.altitude)}</div></div>
          <div class="stat"><span class="label">Peak Combo</span><div class="value">×${ctx.peakCombo}</div></div>
          <div class="stat"><span class="label">Perfect</span><div class="value">${ctx.perfectAnchors}</div></div>
          <div class="stat"><span class="label">Near Miss</span><div class="value">${ctx.nearMisses}</div></div>
          <div class="stat"><span class="label">Time</span><div class="value">${formatTime(ctx.elapsedSeconds)}</div></div>
        </div>
        <div class="stat-grid">
          <div class="stat"><span class="label">XP</span><div class="value">+${ctx.rewards.xp}</div></div>
          <div class="stat"><span class="label">Sparks</span><div class="value">+${ctx.rewards.sparks}</div></div>
          ${ctx.rewards.levelUps.length > 0 ? `<div class="stat"><span class="label">Level Up</span><div class="value">→ ${ctx.rewards.levelUps[ctx.rewards.levelUps.length - 1]}</div></div>` : ''}
          ${ctx.newBestAltitude ? '<div class="stat"><span class="label">New</span><div class="value">Best altitude!</div></div>' : ''}
          ${ctx.newBestScore ? '<div class="stat"><span class="label">New</span><div class="value">Best score!</div></div>' : ''}
          ${ctx.newBestTime ? '<div class="stat"><span class="label">New</span><div class="value">Best time!</div></div>' : ''}
          ${ctx.raceResult && !ctx.racePodium ? `<div class="stat"><span class="label">Race</span><div class="value">${ctx.raceResult.position} of ${ctx.raceResult.total}</div></div>` : ''}
        </div>
        ${streakNudge}
        <div class="actions">
          ${showRevive ? '<button class="primary" data-el="revive">Revive (watch ad)</button>' : ''}
          <button class="primary" data-el="retry">Retry</button>
          ${show2x ? '<button class="ghost" data-el="x2">Double Sparks (watch ad)</button>' : ''}
          <button class="ghost" data-el="menu">Main Menu</button>
        </div>
        <p class="subtitle" style="font-size:11px;margin-top:14px;color:rgba(234,255,255,0.45);text-align:center">Tap anywhere outside this card to retry instantly.</p>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;

    modal.querySelector('[data-el="retry"]')!.addEventListener('click', () => {
      this.close();
      cb.onRetry();
    });
    modal.querySelector('[data-el="menu"]')!.addEventListener('click', () => {
      this.close();
      cb.onMenu();
    });
    modal.querySelector('[data-el="revive"]')?.addEventListener('click', () => {
      this.close();
      cb.onRevive();
    });
    modal.querySelector('[data-el="x2"]')?.addEventListener('click', cb.onWatch2xAd);
  }

  private renderPodium(podium: RacePodiumEntry[]): string {
    const top3 = podium.slice(0, 3);
    if (top3.length === 0) return '';
    // Render center=1st, left=2nd, right=3rd for a classic podium silhouette.
    const slots = [
      { idx: 1, label: '2nd', heightClass: 'h-2nd' },
      { idx: 0, label: '1st', heightClass: 'h-1st' },
      { idx: 2, label: '3rd', heightClass: 'h-3rd' },
    ];
    const items = slots
      .map((slot) => {
        const entry = top3[slot.idx];
        if (!entry) return `<div class="podium-slot ${slot.heightClass} empty"></div>`;
        const time = entry.finishTime !== null ? `${entry.finishTime.toFixed(2)}s` : `${Math.floor(entry.altitude)}m`;
        return `
          <div class="podium-slot ${slot.heightClass} ${entry.isYou ? 'you' : ''}" style="--podium-color:${entry.color}">
            <div class="podium-rank">${slot.label}</div>
            <div class="podium-name">${this.escapeHtml(entry.name)}${entry.isYou ? ' <em>(You)</em>' : ''}</div>
            <div class="podium-stat">${time}</div>
            <div class="podium-pillar"></div>
          </div>
        `;
      })
      .join('');
    return `<div class="race-podium">${items}</div>`;
  }

  private streakNudge(streak: number): string {
    if (streak <= 0) {
      return '';
    }
    if (streak === 1) {
      return `<div class="streak-nudge">🔥 Streak started — come back tomorrow to keep the fire alive.</div>`;
    }
    return `<div class="streak-nudge">🔥 ${streak}-day streak — play tomorrow to extend it.</div>`;
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
