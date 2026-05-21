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

const DASH_DOT_COUNT = PHYSICS.maxDashCharges;

export class HUD {
  private root: HTMLElement;
  private el: {
    container: HTMLDivElement;
    altitude: HTMLDivElement;
    altitudeBest: HTMLDivElement;
    score: HTMLDivElement;
    scoreBest: HTMLDivElement;
    dashDots: HTMLDivElement;
    dashFill: HTMLElement;
    centerCard: HTMLDivElement;
    centerLabel: HTMLDivElement;
    centerValue: HTMLDivElement;
    centerBarFill: HTMLElement;
    centerStatus: HTMLDivElement;
    combo: HTMLDivElement;
  };
  /** Smoothed counter values so digits roll up instead of snapping. */
  private displayedAltitude = 0;
  private displayedScore = 0;
  private lastCombo = 1;
  private lastDashCharges = -1;
  private comboPulseTimer = 0;

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
        <div class="row" style="margin-top:8px">
          <span>Dash</span>
          <div class="dash-dots" data-el="dashDots"></div>
        </div>
        <div class="bar" style="margin-top:4px"><i data-el="dashFill"></i></div>
      </div>
    `;
    this.root.appendChild(container);

    const combo = document.createElement('div');
    combo.className = 'combo-display';
    combo.textContent = '×1';
    document.body.appendChild(combo);

    const dashDots = container.querySelector<HTMLDivElement>('[data-el="dashDots"]')!;
    for (let i = 0; i < DASH_DOT_COUNT; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dashDots.appendChild(dot);
    }

    this.el = {
      container,
      altitude: container.querySelector('[data-el="altitude"]')!,
      altitudeBest: container.querySelector('[data-el="altitudeBest"]')!,
      score: container.querySelector('[data-el="score"]')!,
      scoreBest: container.querySelector('[data-el="scoreBest"]')!,
      dashDots,
      dashFill: container.querySelector('[data-el="dashFill"]')!,
      centerCard: container.querySelector('.hud-card.center')!,
      centerLabel: container.querySelector('[data-el="centerLabel"]')!,
      centerValue: container.querySelector('[data-el="centerValue"]')!,
      centerBarFill: container.querySelector('[data-el="centerBarFill"]')!,
      centerStatus: container.querySelector('[data-el="centerStatus"]')!,
      combo,
    };
  }

  update(ctx: HUDContext): void {
    // Smoothly chase the target altitude/score so digits roll instead of snap.
    const altTarget = ctx.player.maxAltitude;
    const scoreTarget = ctx.scoring.total;
    this.displayedAltitude += (altTarget - this.displayedAltitude) * 0.22;
    this.displayedScore += (scoreTarget - this.displayedScore) * 0.22;
    // Snap when within 1 unit to avoid endless asymptote.
    if (Math.abs(altTarget - this.displayedAltitude) < 1) this.displayedAltitude = altTarget;
    if (Math.abs(scoreTarget - this.displayedScore) < 1) this.displayedScore = scoreTarget;

    this.el.altitude.textContent = formatAltitude(this.displayedAltitude);
    this.el.altitudeBest.textContent = formatAltitude(ctx.bestAltitude);
    this.el.score.textContent = formatScore(Math.floor(this.displayedScore));
    this.el.scoreBest.textContent = formatScore(ctx.bestScore);

    // Dash dots — light up one per charge, soft pulse on the next one to come.
    if (ctx.player.dashCharges !== this.lastDashCharges) {
      this.lastDashCharges = ctx.player.dashCharges;
      const dots = this.el.dashDots.children;
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i] as HTMLElement;
        dot.classList.remove('full', 'charging');
        if (i < ctx.player.dashCharges) dot.classList.add('full');
        else if (i === ctx.player.dashCharges) dot.classList.add('charging');
      }
    }
    const rechargePct =
      ctx.player.dashCharges >= PHYSICS.maxDashCharges
        ? 100
        : (ctx.player.dashRecharge / PHYSICS.dashCooldownFrames) * 100;
    this.el.dashFill.style.width = `${Math.min(100, rechargePct)}%`;

    // Combo: pulse the display on each integer step up.
    if (ctx.combo.combo > 1) {
      this.el.combo.classList.add('active');
      this.el.combo.textContent = `×${ctx.combo.combo}`;
      if (ctx.combo.combo > this.lastCombo) {
        this.el.combo.classList.add('pulse');
        this.comboPulseTimer = 12;
      }
    } else {
      this.el.combo.classList.remove('active');
    }
    if (this.comboPulseTimer > 0) {
      this.comboPulseTimer -= 1;
      if (this.comboPulseTimer === 0) this.el.combo.classList.remove('pulse');
    }
    this.lastCombo = ctx.combo.combo;

    // The center card holds a mode-specific objective: a count-down timer
    // (Time Attack, Combo Run) or a progress % (Bot Race). In Endless Climb
    // there is no objective metric, and showing Altitude here just duplicated
    // the left card — so hide the card entirely instead.
    if (typeof ctx.modeTimer === 'number') {
      this.el.centerCard.classList.remove('hidden');
      this.el.centerLabel.textContent = ctx.modeTimerLabel ?? 'Time';
      this.el.centerValue.textContent = formatTime(ctx.modeTimer);
    } else if (typeof ctx.modeProgress === 'number') {
      this.el.centerCard.classList.remove('hidden');
      this.el.centerLabel.textContent = ctx.modeProgressLabel ?? 'Progress';
      this.el.centerValue.textContent = `${Math.floor(ctx.modeProgress * 100)}%`;
    } else {
      this.el.centerCard.classList.add('hidden');
    }

    if (typeof ctx.modeProgress === 'number') {
      this.el.centerBarFill.style.width = `${Math.min(100, ctx.modeProgress * 100)}%`;
    } else {
      this.el.centerBarFill.style.width = '0%';
    }

    if (ctx.raceStatus) {
      this.el.centerStatus.innerHTML = `<span>Position</span><strong>${ctx.raceStatus}</strong>`;
    } else {
      this.el.centerStatus.innerHTML = '';
    }
  }

  destroy(): void {
    this.el.container.remove();
    this.el.combo.remove();
  }
}
