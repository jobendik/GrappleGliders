import { GameMode } from '../game/GameState';
import { formatAltitude, formatScore, formatTime } from '../utils/format';
import type { RunRewards } from '../systems/ProgressionSystem';

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
  canRevive: boolean;
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
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="title gradient-text">Run Ended</h1>
        <p class="subtitle">${ctx.cause}</p>
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
          ${ctx.raceResult ? `<div class="stat"><span class="label">Race</span><div class="value">${ctx.raceResult.position} of ${ctx.raceResult.total}</div></div>` : ''}
        </div>
        <div class="actions">
          ${ctx.canRevive ? '<button class="primary" data-el="revive">Revive (watch ad)</button>' : ''}
          <button class="primary" data-el="retry">Retry</button>
          <button class="ghost" data-el="x2">Double Sparks (watch ad)</button>
          <button class="ghost" data-el="menu">Main Menu</button>
        </div>
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
    modal.querySelector('[data-el="x2"]')!.addEventListener('click', cb.onWatch2xAd);
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
