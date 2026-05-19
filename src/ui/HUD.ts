import { PHYSICS } from '../game/Physics';
import { formatAltitude, formatScore, formatTime } from '../utils/format';
import type { ComboSystem } from '../systems/ComboSystem';
import type { Player } from '../game/Player';
import type { ScoringSystem } from '../systems/ScoringSystem';
import type { GameMode } from '../game/GameState';

export interface HUDContext {
  mode: GameMode;
  player: Player;
  combo: ComboSystem;
  scoring: ScoringSystem;
  bestAltitude: number;
  bestScore: number;
  modeTimer?: number;
  modeTimerLabel?: string;
  modeProgress?: number;
  modeProgressLabel?: string;
  raceStatus?: string;
}

export class HUD {
  private root: HTMLElement;
  private el: {
    container: HTMLDivElement;
    altitude: HTMLDivElement;
    altitudeBest: HTMLDivElement;
    score: HTMLDivElement;
    scoreBest: HTMLDivElement;
    dashText: HTMLSpanElement;
    dashBar: HTMLElement;
    centerLabel: HTMLDivElement;
    centerValue: HTMLDivElement;
    centerBar: HTMLDivElement;
    centerBarFill: HTMLElement;
    centerStatus: HTMLDivElement;
    combo: HTMLDivElement;
  };

  constructor(root: HTMLElement) {
    this.root = root;
    const container = document.createElement('div');
    container.className = 'hud fade';
    container.innerHTML = `
      <div class="hud-card">
        <span class="label">Altitude</span>
        <div class="big-stat" data-el="altitude">0 m</div>
        <div class="row"><span>Best</span><strong data-el="altitudeBest">0 m</strong></div>
      </div>
      <div class="hud-card center">
        <span class="label" data-el="centerLabel">Objective</span>
        <div class="big-stat" data-el="centerValue">—</div>
        <div class="bar"><i data-el="centerBarFill"></i></div>
        <div class="row" data-el="centerStatus"><span></span><strong></strong></div>
      </div>
      <div class="hud-card right">
        <span class="label">Score</span>
        <div class="big-stat" data-el="score">0</div>
        <div class="row"><span>Best</span><strong data-el="scoreBest">0</strong></div>
        <div class="row"><span>Dash</span><strong data-el="dashText">2 / 2</strong></div>
        <div class="bar"><i data-el="dashBar"></i></div>
      </div>
    `;
    this.root.appendChild(container);

    const combo = document.createElement('div');
    combo.className = 'combo-display';
    combo.textContent = '×1';
    document.body.appendChild(combo);

    this.el = {
      container,
      altitude: container.querySelector('[data-el="altitude"]')!,
      altitudeBest: container.querySelector('[data-el="altitudeBest"]')!,
      score: container.querySelector('[data-el="score"]')!,
      scoreBest: container.querySelector('[data-el="scoreBest"]')!,
      dashText: container.querySelector('[data-el="dashText"]')!,
      dashBar: container.querySelector('[data-el="dashBar"]')!,
      centerLabel: container.querySelector('[data-el="centerLabel"]')!,
      centerValue: container.querySelector('[data-el="centerValue"]')!,
      centerBar: container.querySelector('.bar')!,
      centerBarFill: container.querySelector('[data-el="centerBarFill"]')!,
      centerStatus: container.querySelector('[data-el="centerStatus"]')!,
      combo,
    };
  }

  update(ctx: HUDContext): void {
    this.el.altitude.textContent = formatAltitude(ctx.player.maxAltitude);
    this.el.altitudeBest.textContent = formatAltitude(ctx.bestAltitude);
    this.el.score.textContent = formatScore(ctx.scoring.total);
    this.el.scoreBest.textContent = formatScore(ctx.bestScore);
    this.el.dashText.textContent = `${ctx.player.dashCharges} / ${PHYSICS.maxDashCharges}`;
    const rechargePct =
      ctx.player.dashCharges >= PHYSICS.maxDashCharges
        ? 100
        : (ctx.player.dashRecharge / PHYSICS.dashCooldownFrames) * 100;
    this.el.dashBar.style.width = `${Math.min(100, rechargePct)}%`;

    if (ctx.combo.combo > 1) {
      this.el.combo.classList.add('active');
      this.el.combo.textContent = `×${ctx.combo.combo}`;
    } else {
      this.el.combo.classList.remove('active');
    }

    if (typeof ctx.modeTimer === 'number') {
      this.el.centerLabel.textContent = ctx.modeTimerLabel ?? 'Time';
      this.el.centerValue.textContent = formatTime(ctx.modeTimer);
    } else if (typeof ctx.modeProgress === 'number') {
      this.el.centerLabel.textContent = ctx.modeProgressLabel ?? 'Progress';
      this.el.centerValue.textContent = `${Math.floor(ctx.modeProgress * 100)}%`;
    } else {
      this.el.centerLabel.textContent = 'Altitude';
      this.el.centerValue.textContent = formatAltitude(ctx.player.maxAltitude);
    }

    if (typeof ctx.modeProgress === 'number') {
      this.el.centerBarFill.style.width = `${Math.min(100, ctx.modeProgress * 100)}%`;
    } else {
      this.el.centerBarFill.style.width = '0%';
    }

    if (ctx.raceStatus) {
      this.el.centerStatus.innerHTML = `<span>${ctx.raceStatus}</span>`;
    } else {
      this.el.centerStatus.innerHTML = '';
    }
  }

  destroy(): void {
    this.el.container.remove();
    this.el.combo.remove();
  }
}
