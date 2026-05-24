import { GameMode } from '../game/GameState';
import { formatAltitude, formatScore, formatTime } from '../utils/format';
import type { RunRewards } from '../systems/ProgressionSystem';
import type { NextUnlockPreview } from '../systems/UnlockSystem';
import type { TrickRunSummary } from '../systems/TrickSystem';

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
  eyebrow?: string;
  nudge?: string;
  retryLabel?: string;
  retrySub?: string;
  reviveLabel?: string;
  reviveSub?: string;
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
  /** Whether the 2x Sparks rewarded-ad offer is still available. */
  canWatch2xAd?: boolean;
  /** Current daily-login streak in days. */
  dailyStreak: number;
  /** Cheapest cosmetic the player is progressing toward. */
  nextUnlock?: NextUnlockPreview;
  /** Tricks landed this run, sorted by score impact. */
  trickSummary?: TrickRunSummary;
  /** Whether a recorded run clip is available for download/share. */
  replayAvailable?: boolean;
}

export interface GameOverCallbacks {
  onRetry(): void;
  onRevive(): void;
  onMenu(): void;
  onWatch2xAd(): void;
  onShare(): void;
  /** Optional: download / share the recorded clip of this run. */
  onSaveClip?(): void;
}

interface Hero {
  label: string;
  value: string;
  isPB: boolean;
}

interface GameOverPresentation {
  eyebrow: string;
  retryLabel: string;
  retrySub: string;
  reviveLabel: string;
  reviveSub: string;
  nudge: string;
}

export const resolveGameOverPresentation = (
  ctx: GameOverContext,
  showRevive: boolean,
): GameOverPresentation => ({
  eyebrow: ctx.eyebrow ?? (ctx.newBestAltitude || ctx.newBestScore || ctx.newBestTime ? 'New Best' : 'Run Ended'),
  retryLabel: ctx.retryLabel ?? (showRevive ? 'Fresh Run' : 'Retry'),
  retrySub: ctx.retrySub ?? (showRevive ? 'Restart from the ground' : 'Back in instantly'),
  reviveLabel: ctx.reviveLabel ?? 'Keep This Run',
  reviveSub: ctx.reviveSub ?? 'Watch ad to continue',
  nudge: ctx.nudge ?? '',
});

export class GameOverScreen {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(ctx: GameOverContext, cb: GameOverCallbacks): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
        cb.onRetry();
      }
    });
    const modal = document.createElement('div');
    modal.className = 'modal gameover-v2';

    const showRevive = ctx.canRevive && ctx.adsAvailable;
    const show2x = ctx.adsAvailable && ctx.canWatch2xAd !== false;
    const showClip = ctx.replayAvailable === true && typeof cb.onSaveClip === 'function';
    const presentation = resolveGameOverPresentation(ctx, showRevive);
    const streakNudge = this.streakNudge(ctx.dailyStreak);
    const podiumHtml = ctx.racePodium ? this.renderPodium(ctx.racePodium) : '';
    const trickHtml = ctx.trickSummary ? this.renderTrickSummary(ctx.trickSummary) : '';
    const unlockHtml = ctx.nextUnlock
      ? this.renderUnlockProgress(ctx.nextUnlock, ctx.rewards.sparks)
      : '';
    const hero = !ctx.racePodium ? this.heroFor(ctx) : null;
    const heroHtml = hero ? this.renderHero(hero) : '';
    const statHtml = this.renderStats(ctx);
    const rewardHtml = this.renderRewards(ctx.rewards);

    modal.innerHTML = `
      <div class="modal-content">
        <span class="gameover-eyebrow">${this.escapeHtml(presentation.eyebrow)}</span>
        <p class="gameover-cause">${this.escapeHtml(ctx.cause)}</p>

        ${podiumHtml}
        ${heroHtml}
        ${statHtml}
        ${rewardHtml}

        ${unlockHtml}
        ${trickHtml}
        ${streakNudge}
        ${presentation.nudge ? `<div class="gameover-nudge">${this.escapeHtml(presentation.nudge)}</div>` : ''}

        <div class="gameover-actions">
          <button class="primary large gameover-retry" data-el="retry"><span class="gameover-action-stack"><span class="gameover-action-label">${this.escapeHtml(presentation.retryLabel)}</span><em class="gameover-action-sub">${this.escapeHtml(presentation.retrySub)}</em></span></button>
          ${showRevive ? `<button class="ad-btn gameover-revive-cta" data-el="revive"><span class="ad-icon">▶</span><span class="gameover-action-stack"><span class="ad-label">${this.escapeHtml(presentation.reviveLabel)}</span><em class="ad-sub">${this.escapeHtml(presentation.reviveSub)}</em></span></button>` : ''}
        </div>

        <div class="gameover-tertiary">
          <button class="ghost small" data-el="share">Share</button>
          ${show2x ? '<button class="ghost small ad-ghost" data-el="x2"><span>▶</span> 2× Sparks</button>' : ''}
          ${showClip ? '<button class="ghost small" data-el="clip">Save Clip</button>' : ''}
          <button class="ghost small" data-el="menu">Main Menu</button>
        </div>

        <p class="gameover-hint">Tap outside · press <kbd>R</kbd> to retry · <kbd>M</kbd> for menu</p>
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
    modal.querySelector('[data-el="share"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      cb.onShare();
    });
    modal.querySelector('[data-el="clip"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      cb.onSaveClip?.();
    });

    // Keyboard shortcuts — R retries, M returns to menu. Most-eager players hit
    // a key before the modal even finishes its entry animation.
    this.keyHandler = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.key === 'r' || e.key === 'R' || e.key === 'Enter') {
        e.preventDefault();
        this.close();
        cb.onRetry();
      } else if (e.key === 'm' || e.key === 'M' || e.key === 'Escape') {
        e.preventDefault();
        this.close();
        cb.onMenu();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  /** Pick the single most-relevant metric for the mode. */
  private heroFor(ctx: GameOverContext): Hero {
    switch (ctx.mode) {
      case GameMode.EndlessClimb:
        return {
          label: 'Altitude',
          value: formatAltitude(ctx.altitude),
          isPB: ctx.newBestAltitude,
        };
      case GameMode.DailyChallenge:
        return {
          label: 'Daily Score',
          value: formatScore(ctx.score),
          isPB: ctx.newBestScore,
        };
      case GameMode.TimeAttack:
        return {
          label: 'Finish Time',
          value: formatTime(ctx.elapsedSeconds),
          isPB: ctx.newBestTime,
        };
      case GameMode.ComboRun:
        return {
          label: 'Score',
          value: formatScore(ctx.score),
          isPB: ctx.newBestScore,
        };
      case GameMode.BotRace: {
        const pos = ctx.raceResult?.position ?? 0;
        const total = ctx.raceResult?.total ?? 0;
        return {
          label: 'Finish',
          value: pos > 0 ? `${this.ordinal(pos)} of ${total}` : `${formatAltitude(ctx.altitude)}`,
          isPB: pos === 1,
        };
      }
    }
  }

  private renderHero(hero: Hero): string {
    const pb = hero.isPB ? '<span class="pb-badge">⭐ NEW BEST</span>' : '';
    return `
      <div class="gameover-hero">
        <span class="gameover-hero-label">${hero.label}</span>
        <div class="gameover-hero-value">${hero.value}</div>
        ${pb}
      </div>
    `;
  }

  /** Compact 6-tile stat grid; omits the metric already shown in the hero. */
  private renderStats(ctx: GameOverContext): string {
    const cells: Array<[string, string] | null> = [
      [`Score`, formatScore(ctx.score)],
      [`Altitude`, formatAltitude(ctx.altitude)],
      [`Time`, formatTime(ctx.elapsedSeconds)],
      [`Peak Combo`, `×${ctx.peakCombo}`],
      [`Perfect`, String(ctx.perfectAnchors)],
      [`Near Miss`, String(ctx.nearMisses)],
    ];
    // Drop the cell that duplicates the hero stat to avoid redundancy.
    const skip = this.heroStatLabel(ctx.mode);
    const visible = cells.filter((c): c is [string, string] => !!c && c[0] !== skip);
    const html = visible
      .map(
        ([label, value]) =>
          `<div class="stat"><span class="label">${label}</span><div class="value">${value}</div></div>`,
      )
      .join('');
    return `<div class="stat-grid stat-grid-compact">${html}</div>`;
  }

  private heroStatLabel(mode: GameMode): string {
    switch (mode) {
      case GameMode.EndlessClimb:
        return 'Altitude';
      case GameMode.DailyChallenge:
        return 'Score';
      case GameMode.TimeAttack:
        return 'Time';
      case GameMode.ComboRun:
        return 'Score';
      case GameMode.BotRace:
        return '';
    }
  }

  /** Inline reward summary — terser than a stat grid, but still spotlights PB. */
  private renderRewards(rewards: RunRewards): string {
    const levelUp =
      rewards.levelUps.length > 0
        ? ` · Level <strong>→ ${rewards.levelUps[rewards.levelUps.length - 1]}</strong>`
        : '';
    return `
      <div class="gameover-rewards">
        <span>+<strong>${rewards.xp}</strong> XP</span>
        <span>·</span>
        <span>+<strong>${rewards.sparks}</strong> Sparks</span>
        ${levelUp}
      </div>
    `;
  }

  private ordinal(n: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? 'th';
    return `${n}${suffix}`;
  }

  /**
   * Render a Sparks-progress bar toward the next unlock. Combines the player's
   * starting balance (current minus the freshly-awarded run sparks) with the
   * run contribution so the bar visibly fills.
   */
  private renderUnlockProgress(preview: NextUnlockPreview, runSparks: number): string {
    const total = preview.current;
    const cost = preview.cost;
    const baseline = Math.max(0, total - runSparks);
    const baselineProgress = Math.min(1, baseline / cost);
    const totalProgress = Math.min(1, total / cost);
    const remaining = Math.max(0, cost - total);
    const summary = remaining === 0
      ? `Ready to claim: ${this.escapeHtml(preview.name)}`
      : `+${runSparks} toward <strong>${this.escapeHtml(preview.name)}</strong> — ${remaining} more Sparks`;
    return `
      <div class="unlock-progress" aria-label="Next unlock progress">
        <div class="unlock-progress-track">
          <div class="unlock-progress-fill base" style="width:${(baselineProgress * 100).toFixed(1)}%"></div>
          <div class="unlock-progress-fill earned" style="width:${(totalProgress * 100).toFixed(1)}%"></div>
        </div>
        <div class="unlock-progress-label">${summary}</div>
      </div>
    `;
  }

  /**
   * Render the top tricks landed this run as a chip row. Skips entirely when
   * no tricks were detected to avoid empty UI on early-death runs.
   */
  private renderTrickSummary(summary: TrickRunSummary): string {
    if (summary.tricks.length === 0) return '';
    const top = summary.tricks.slice(0, 4);
    const chips = top
      .map((t) => {
        const count = t.count > 1 ? ` ×${t.count}` : '';
        return `<span class="trick-chip" style="--trick-color:${t.color}">${this.escapeHtml(t.name)}${count}<em>+${Math.floor(t.score)}</em></span>`;
      })
      .join('');
    const tail = summary.tricks.length > top.length ? ` <span class="trick-chip-more">+${summary.tricks.length - top.length} more</span>` : '';
    return `
      <div class="trick-summary" aria-label="Tricks landed">
        <div class="trick-summary-header">TRICKS LANDED <em>+${Math.floor(summary.totalScore)} bonus</em></div>
        <div class="trick-summary-chips">${chips}${tail}</div>
      </div>
    `;
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
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
