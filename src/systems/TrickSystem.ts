/**
 * Trick detection. Reads physics state per frame and emits named tricks like
 * Drop, Whip, Pendulum, Wall Run, Threading, Slingshot, Skim. Each detected
 * trick produces a score bonus and a callout event the game shows mid-run.
 *
 * Pure observer — owns no game state, never mutates anything outside its own
 * tracking buffers. Add new detectors by adding an entry to TRICK_DEFS and a
 * branch in update().
 */

import type { Player } from '../game/Player';

export type TrickId =
  | 'drop'
  | 'whip'
  | 'pendulum'
  | 'wall-run'
  | 'threading'
  | 'slingshot'
  | 'skim';

export interface TrickDef {
  id: TrickId;
  name: string;
  /** Base bonus score before applying the player's combo multiplier. */
  baseScore: number;
  /** Pretty color used in mid-run callouts and end-of-run chips. */
  color: string;
}

export const TRICK_DEFS: Record<TrickId, TrickDef> = {
  drop: { id: 'drop', name: 'DROP', baseScore: 60, color: '#a4f0ff' },
  whip: { id: 'whip', name: 'WHIP', baseScore: 120, color: '#ff2bff' },
  pendulum: { id: 'pendulum', name: 'PENDULUM', baseScore: 80, color: '#00f3ff' },
  'wall-run': { id: 'wall-run', name: 'WALL RUN', baseScore: 90, color: '#00ff8a' },
  threading: { id: 'threading', name: 'THREADING', baseScore: 75, color: '#ffd400' },
  slingshot: { id: 'slingshot', name: 'SLINGSHOT', baseScore: 100, color: '#ff9d2e' },
  skim: { id: 'skim', name: 'SKIM', baseScore: 150, color: '#ff255e' },
};

export interface TrickEvent {
  id: TrickId;
  name: string;
  /** Score awarded (already multiplied by combo at emit time). */
  score: number;
  /** Color used by callout. */
  color: string;
  /** World-space position where the trick resolved (for floating callouts). */
  x: number;
  y: number;
  /** Per-trick "intensity" 0..1 — drives haptic/sfx variation. */
  intensity: number;
}

/** Aggregated per-trick stats over the course of a single run. */
export interface TrickSummaryEntry {
  id: TrickId;
  name: string;
  color: string;
  count: number;
  score: number;
}

export interface TrickRunSummary {
  tricks: TrickSummaryEntry[];
  totalScore: number;
  totalCount: number;
}

/** Snapshot of game state the trick system needs per frame. */
export interface TrickUpdateState {
  player: Player;
  killY: number;
  /** Combo multiplier applied to base score. */
  comboMultiplier: number;
  /** Frame timestamp (game frames since run start, scaled by dt). */
  framesSinceStart: number;
}

/**
 * Internal record of recent hook lifecycle events. Used by Whip detection to
 * spot 3 rapid hook fires with rising release velocity within 2 seconds.
 */
interface HookEventRecord {
  frame: number;
  releaseSpeed: number;
}

/** Trick events emitted to the host game. */
export type TrickListener = (event: TrickEvent) => void;

const FRAMES_PER_SECOND = 60;

export class TrickSystem {
  private listeners: TrickListener[] = [];
  private summaries: Map<TrickId, TrickSummaryEntry> = new Map();

  // Hook lifecycle tracking
  private prevHookState: 'idle' | 'shooting' | 'attached' | 'reeling' = 'idle';
  /** Y at which the player last released the hook. NaN = no release yet. */
  private lastReleaseY: number = Number.NaN;
  /** Cumulative arc angle around the current anchor, radians. */
  private swingArcRad = 0;
  /** Last frame's angle (radians) from player to anchor; for arc accumulation. */
  private lastAnchorAngle: number = Number.NaN;
  /** Player velocity at last attach (for slingshot detection). */
  private lastAttachSpeed = 0;
  /** Frame at last release. */
  private lastReleaseFrame = -10000;
  /** Player rope length at last attach (used to detect full-extension release). */
  private attachRopeLength = 0;
  /** Recent hook release events, used by Whip detection. */
  private recentReleases: HookEventRecord[] = [];
  /** True if player held reel-in on the current attach (slingshot pre-condition). */
  private reeledThisAttach = false;
  /** Frame at last wall-touch event (onBounce). */
  private lastBounceFrame = -10000;
  /** Bounce speed at that moment. */
  private lastBounceSpeed = 0;
  /** Whether bounce was mostly horizontal (wall-like). */
  private lastBounceHorizontal = false;
  /** Near-miss count within the current airborne arc (Threading). */
  private airborneNearMisses = 0;
  /** Skim accumulator — frames spent close to lava. */
  private skimFrames = 0;
  /** Tracks whether a Skim was already emitted in this "lava-hug" episode. */
  private skimEmittedThisEpisode = false;

  on(listener: TrickListener): void {
    this.listeners.push(listener);
  }

  reset(): void {
    this.summaries.clear();
    this.prevHookState = 'idle';
    this.lastReleaseY = Number.NaN;
    this.swingArcRad = 0;
    this.lastAnchorAngle = Number.NaN;
    this.lastAttachSpeed = 0;
    this.lastReleaseFrame = -10000;
    this.attachRopeLength = 0;
    this.recentReleases.length = 0;
    this.reeledThisAttach = false;
    this.lastBounceFrame = -10000;
    this.lastBounceSpeed = 0;
    this.lastBounceHorizontal = false;
    this.airborneNearMisses = 0;
    this.skimFrames = 0;
    this.skimEmittedThisEpisode = false;
  }

  /** Called every frame from Game.updatePlay before player.update. */
  update(state: TrickUpdateState): void {
    const player = state.player;
    const hookState = player.hook.state;

    // Hook lifecycle transitions
    if (hookState === 'attached' && this.prevHookState !== 'attached') {
      // Just attached.
      this.lastAttachSpeed = player.vel.len();
      this.attachRopeLength = player.hook.ropeLength;
      this.swingArcRad = 0;
      const ax = player.hook.position.x - player.pos.x;
      const ay = player.hook.position.y - player.pos.y;
      this.lastAnchorAngle = Math.atan2(ay, ax);
      this.reeledThisAttach = false;
      this.airborneNearMisses = 0;
      // Wall-run check: if a recent bounce (within 30 frames) was mostly
      // horizontal and at high speed, this attach completes the trick.
      const sinceBounce = state.framesSinceStart - this.lastBounceFrame;
      if (
        sinceBounce >= 0 &&
        sinceBounce <= 30 &&
        this.lastBounceHorizontal &&
        this.lastBounceSpeed > 25
      ) {
        this.emit('wall-run', state, player.pos.x, player.pos.y, Math.min(1, this.lastBounceSpeed / 40));
        this.lastBounceFrame = -10000;
      }
      // Drop check: were we airborne (idle) after a release, and fell ≥800px before re-grappling?
      if (
        !Number.isNaN(this.lastReleaseY) &&
        player.pos.y - this.lastReleaseY >= 800 &&
        state.framesSinceStart - this.lastReleaseFrame <= 5 * FRAMES_PER_SECOND
      ) {
        const drop = player.pos.y - this.lastReleaseY;
        this.emit('drop', state, player.pos.x, player.pos.y, Math.min(1, drop / 1600));
      }
    } else if (hookState === 'attached') {
      // Continuing to swing — accumulate arc and detect reel input.
      const ax = player.hook.position.x - player.pos.x;
      const ay = player.hook.position.y - player.pos.y;
      const angle = Math.atan2(ay, ax);
      if (!Number.isNaN(this.lastAnchorAngle)) {
        let delta = angle - this.lastAnchorAngle;
        // Wrap into (-π, π) so a full sweep doesn't double-count.
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        this.swingArcRad += Math.abs(delta);
      }
      this.lastAnchorAngle = angle;
      // Slingshot pre-condition: rope length shrinking (player reeled in).
      if (player.hook.ropeLength < this.attachRopeLength - 20) {
        this.reeledThisAttach = true;
      }
    } else if (hookState === 'idle' && this.prevHookState === 'attached') {
      // Just released.
      this.lastReleaseFrame = state.framesSinceStart;
      this.lastReleaseY = player.pos.y;
      const releaseSpeed = player.vel.len();
      // Pendulum: swing arc >180° before release (one full half-rotation).
      if (this.swingArcRad > Math.PI) {
        this.emit(
          'pendulum',
          state,
          player.pos.x,
          player.pos.y,
          Math.min(1, this.swingArcRad / (Math.PI * 2)),
        );
      }
      // Slingshot: reeled in during this attach, released near full extension,
      // and gained a meaningful speed bump versus attach time.
      if (
        this.reeledThisAttach &&
        releaseSpeed > this.lastAttachSpeed + 6 &&
        releaseSpeed > 22
      ) {
        this.emit(
          'slingshot',
          state,
          player.pos.x,
          player.pos.y,
          Math.min(1, (releaseSpeed - 22) / 18),
        );
      }
      // Record this release for Whip detection.
      this.recentReleases.push({
        frame: state.framesSinceStart,
        releaseSpeed,
      });
      // Trim window to last 2 seconds.
      const cutoff = state.framesSinceStart - 2 * FRAMES_PER_SECOND;
      while (this.recentReleases.length > 0 && this.recentReleases[0]!.frame < cutoff) {
        this.recentReleases.shift();
      }
      // Whip: 3 releases in 2s, each faster than the previous.
      if (this.recentReleases.length >= 3) {
        const tail = this.recentReleases.slice(-3);
        const ascending =
          tail[1]!.releaseSpeed > tail[0]!.releaseSpeed &&
          tail[2]!.releaseSpeed > tail[1]!.releaseSpeed;
        if (ascending) {
          this.emit(
            'whip',
            state,
            player.pos.x,
            player.pos.y,
            Math.min(1, tail[2]!.releaseSpeed / 32),
          );
          // Reset to avoid immediate retriggers on the next release.
          this.recentReleases.length = 0;
        }
      }
      // Reset per-attach trackers.
      this.swingArcRad = 0;
      this.lastAnchorAngle = Number.NaN;
      this.reeledThisAttach = false;
    } else {
      // Airborne / shooting / reeling — clear the per-anchor angle tracker.
      this.lastAnchorAngle = Number.NaN;
    }

    // Skim: hugging lava (within 30 px of killY) for 25+ frames at high speed.
    const distToLava = state.killY - player.pos.y;
    if (distToLava > 0 && distToLava < 40 && player.vel.len() > 18 && !player.dead) {
      this.skimFrames += 1;
      if (this.skimFrames >= 25 && !this.skimEmittedThisEpisode) {
        this.emit('skim', state, player.pos.x, player.pos.y, Math.min(1, player.vel.len() / 34));
        this.skimEmittedThisEpisode = true;
      }
    } else if (distToLava >= 80 || distToLava <= 0) {
      // Clear the episode lock once the player escapes back up or actually dies.
      this.skimFrames = 0;
      this.skimEmittedThisEpisode = false;
    }

    this.prevHookState = hookState as typeof this.prevHookState;
  }

  /**
   * External event hook: called by Game when player.onBounce fires. Captures
   * the wall-touch context so wall-run can resolve when the player grapples
   * within the next few frames.
   */
  onBounce(speed: number, horizontal: boolean, frame: number): void {
    this.lastBounceFrame = frame;
    this.lastBounceSpeed = speed;
    this.lastBounceHorizontal = horizontal;
  }

  /**
   * External event hook: called by Game when player.onNearMiss fires. Counts
   * near-misses within the current airborne arc (Threading) and emits the
   * trick once 3+ accumulate before the next anchor.
   */
  onNearMiss(state: TrickUpdateState): void {
    // Only count near-misses while airborne — Threading is "thread through
    // multiple obstacles in one fly-by," not a passive sweep.
    if (state.player.hook.state === 'attached') return;
    this.airborneNearMisses += 1;
    if (this.airborneNearMisses === 3) {
      this.emit(
        'threading',
        state,
        state.player.pos.x,
        state.player.pos.y,
        Math.min(1, this.airborneNearMisses / 5),
      );
    }
  }

  private emit(
    id: TrickId,
    state: TrickUpdateState,
    x: number,
    y: number,
    intensity: number,
  ): void {
    const def = TRICK_DEFS[id];
    const score = def.baseScore * state.comboMultiplier;
    const event: TrickEvent = {
      id,
      name: def.name,
      score,
      color: def.color,
      x,
      y,
      intensity: Math.max(0, Math.min(1, intensity)),
    };
    // Update aggregate summary
    const existing = this.summaries.get(id);
    if (existing) {
      existing.count += 1;
      existing.score += score;
    } else {
      this.summaries.set(id, {
        id,
        name: def.name,
        color: def.color,
        count: 1,
        score,
      });
    }
    for (const l of this.listeners) l(event);
  }

  /** Snapshot for the end-of-run screen. Sorted by total score, descending. */
  summary(): TrickRunSummary {
    const tricks = Array.from(this.summaries.values()).sort((a, b) => b.score - a.score);
    const totalScore = tricks.reduce((s, t) => s + t.score, 0);
    const totalCount = tricks.reduce((s, t) => s + t.count, 0);
    return { tricks, totalScore, totalCount };
  }
}
