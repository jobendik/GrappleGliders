import { Vec2 } from './Physics';
import { Player, type PlayerInputState } from './Player';
import type { Obstacle, World } from './World';
import { HookRenderer } from '../render/HookRenderer';
import type { HookDef } from '../content/hooks';

export interface BotPersonality {
  name: string;
  color: string;
  /** Frames between target re-evaluations while idle. Lower = faster reactions. */
  reactionFrames: number;
  /** 0..1 — drives dash frequency and willingness to pick risky paths. */
  aggression: number;
  /** 0..1 — inverse of aim jitter. Apex ~0.92, Sparky ~0.5. */
  accuracy: number;
  /** 0..1 — gates pumping, lookahead planning, and dash usage. */
  skill: number;
}

export const BOT_PERSONALITIES: BotPersonality[] = [
  { name: 'Sparky', color: '#ff9d2e', reactionFrames: 14, aggression: 0.2, accuracy: 0.5, skill: 0.45 },
  { name: 'Phase', color: '#a45cff', reactionFrames: 8, aggression: 0.45, accuracy: 0.72, skill: 0.7 },
  { name: 'Apex', color: '#ff255e', reactionFrames: 4, aggression: 0.85, accuracy: 0.94, skill: 1.0 },
];

interface TargetPick {
  obstacle: Obstacle;
  aim: Vec2;
}

export class Bot {
  player: Player;
  personality: BotPersonality;
  /** Per-bot rope/hook renderer so each bot's rope animation has its own flash state. */
  hookRenderer = new HookRenderer();
  /** Rope definition tinted to the bot's personality color — used by hookRenderer. */
  hookDef: HookDef;

  private currentTarget: TargetPick | null = null;
  private nextTarget: TargetPick | null = null;
  private reaction = 0;
  private framesAttached = 0;
  private lastReleaseFrame = -999;
  private dashCooldown = 0;
  private stuckFrames = 0;
  private lastProgressY: number;

  constructor(personality: BotPersonality, startX: number, startY: number) {
    this.personality = personality;
    this.player = new Player(startX, startY);
    this.player.radius = 12;
    this.lastProgressY = startY;
    this.hookDef = {
      id: `bot-${personality.name.toLowerCase()}`,
      name: `${personality.name} Hook`,
      cost: 0,
      rope: 'cable',
      color: personality.color,
      width: 1.4,
    };
  }

  reset(x: number, y: number): void {
    this.player.reset(x, y);
    this.currentTarget = null;
    this.nextTarget = null;
    this.reaction = 0;
    this.framesAttached = 0;
    this.lastReleaseFrame = -999;
    this.dashCooldown = 0;
    this.stuckFrames = 0;
    this.lastProgressY = y;
  }

  update(dt: number, world: World, killY: number, frame: number): void {
    if (this.player.dead) return;
    this.reaction += dt;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    // Track stuck-ness for fallback dash. Vertical progress = pos.y getting smaller.
    if (this.player.pos.y < this.lastProgressY - 4) {
      this.lastProgressY = this.player.pos.y;
      this.stuckFrames = 0;
    } else {
      this.stuckFrames += dt;
    }

    this.invalidateStaleTargets();

    // Pick a new primary target when idle and reaction window elapsed, or when missing one.
    const idle = this.player.hook.state === 'idle';
    if (idle && (!this.currentTarget || this.reaction >= this.personality.reactionFrames)) {
      this.currentTarget = this.pickTarget(world, this.player.pos);
      this.reaction = 0;
    }

    // While attached, plan the next target so release transitions are seamless.
    if (
      this.personality.skill > 0.55 &&
      this.player.hook.state === 'attached' &&
      !this.nextTarget
    ) {
      this.nextTarget = this.pickTargetFromFuture(world);
    }

    const input: PlayerInputState = {
      moveX: 0,
      reel: 0,
      pointerDown: false,
      dashRequested: false,
      hookTarget: null,
      releaseHook: false,
    };

    if (idle && this.currentTarget) {
      input.hookTarget = this.currentTarget.aim;
      this.framesAttached = 0;
    } else if (this.player.hook.state === 'attached') {
      this.framesAttached += dt;
      this.driveSwing(input, frame);
    }
    // 'shooting' state: wait for hook to connect or miss.

    this.maybeDash(input, killY);

    this.player.update(dt, input, world, killY);

    // Post-update bookkeeping: when the hook returned to idle this tick, advance to the next target.
    if (this.player.hook.state === 'idle' && this.framesAttached > 0) {
      this.framesAttached = 0;
      if (this.nextTarget) {
        this.currentTarget = this.nextTarget;
        this.nextTarget = null;
      } else {
        this.currentTarget = null;
      }
      this.reaction = 0;
    }
  }

  private invalidateStaleTargets(): void {
    const dead = (t: TargetPick | null): boolean => {
      if (!t) return false;
      const o = t.obstacle;
      if (o.collected) return true;
      if (o.unstableTriggered && o.unstableTimer > 18) return true;
      // Target ran out of world (culled below).
      if (o.y > this.player.pos.y + 800) return true;
      return false;
    };
    if (dead(this.currentTarget)) this.currentTarget = null;
    if (dead(this.nextTarget)) this.nextTarget = null;
  }

  private driveSwing(input: PlayerInputState, frame: number): void {
    const hookPos = this.player.hook.position;
    const pos = this.player.pos;
    const dy = pos.y - hookPos.y;
    const playerBelowAnchor = dy > 4;
    const playerAboveAnchor = dy < -4;

    // Reeling: pull toward the anchor when below it. Skill scales how often we reel.
    // Lower-skill bots reel less, so they swing wider but slower.
    if (playerBelowAnchor) {
      input.pointerDown = Math.random() < 0.6 + this.personality.skill * 0.4;
    } else if (playerAboveAnchor) {
      // Above the anchor — feed rope out a touch so we don't yank ourselves backward.
      input.reel = 1;
    }

    // Swing pumping. The previous version gated pumping behind `skill > 0.5`
    // AND `|vel.x| > 1`, which meant low-skill bots never pumped at all and
    // high-skill bots couldn't kick off a swing from rest — they hung at the
    // anchor's equilibrium point with zero velocity, never building enough
    // upward energy to satisfy the release condition. Result: dead-hang for
    // 4 seconds until the anti-deadlock fired, then drop and re-attach to the
    // same anchor in an endless loop.
    //
    // Now: every bot pumps. With existing horizontal motion we pump WITH the
    // velocity (classic pump-up). From rest, we bias toward the next target
    // if known, otherwise pick a stable initial direction so the bot at least
    // starts swinging.
    if (Math.abs(this.player.vel.x) > 0.6) {
      input.moveX = this.player.vel.x > 0 ? 1 : -1;
    } else if (this.nextTarget) {
      input.moveX = this.nextTarget.aim.x > pos.x ? 1 : -1;
    } else {
      // Pump away from the rope so the pendulum starts opening.
      const ropeDx = pos.x - hookPos.x;
      input.moveX = ropeDx >= 0 ? 1 : -1;
    }

    // Release decision. Wait for actual upward energy before letting go.
    const speed = Math.hypot(this.player.vel.x, this.player.vel.y);
    // Thresholds scaled by skill: high-skill bots wait for cleaner releases,
    // low-skill bots release at any upward velocity. Even Apex (skill 1) gets
    // a forgiving lower bound so it doesn't hang waiting for "perfect" energy
    // that the pendulum from rest can't realistically build.
    const liftThreshold = -3 - this.personality.skill * 2; // skill 0 → -3, skill 1 → -5
    const speedThreshold = 4 + this.personality.skill * 2.5; // skill 0 → 4, skill 1 → 6.5
    const sufficientLift = this.player.vel.y < liftThreshold;
    const minAttachedFrames = 10 + (1 - this.personality.skill) * 16;
    const cooldownOk = frame - this.lastReleaseFrame > 16;
    const energyReady = speed > speedThreshold && sufficientLift;

    let shouldRelease = energyReady && this.framesAttached >= minAttachedFrames && cooldownOk;

    // Anti-deadlock: bail after ~1s on the same hook. Even at sub-optimal
    // velocity, releasing and re-aiming progresses faster than hanging on a
    // pendulum that's never going to satisfy the release condition.
    if (!shouldRelease && this.framesAttached > 60 && cooldownOk) {
      shouldRelease = true;
    }

    if (shouldRelease) {
      input.releaseHook = true;
      this.lastReleaseFrame = frame;
    }
  }

  private maybeDash(input: PlayerInputState, killY: number): void {
    if (this.player.dashCharges <= 0) return;
    if (this.dashCooldown > 0) return;
    const lavaPressure = killY - this.player.pos.y;
    const lavaClose = lavaPressure < 320;
    const stuck = this.stuckFrames > 180;
    // Only consider a "falling idle" dash worthwhile when we have a target to aim at.
    // Dashing straight up into empty space (no obstacles in world) is wasteful and breaks
    // the "graceful no-op when there's nothing to grapple to" contract.
    const fallingIdle =
      this.player.hook.state === 'idle' && this.player.vel.y > 1.5 && this.currentTarget !== null;
    if (!lavaClose && !stuck && !fallingIdle) return;
    // Aggression × skill gates dash probability per tick.
    const chance = this.personality.aggression * (lavaClose ? 0.08 : 0.03) * (0.5 + this.personality.skill * 0.5);
    if (Math.random() >= chance) return;
    input.dashRequested = true;
    // Dash toward the current target if we have one, otherwise straight up.
    if (this.currentTarget) {
      input.hookTarget = this.currentTarget.aim;
    } else {
      input.hookTarget = new Vec2(this.player.pos.x, this.player.pos.y - 220);
    }
    this.dashCooldown = 50;
    if (stuck) this.stuckFrames = 0;
  }

  private pickTarget(world: World, from: Vec2): TargetPick | null {
    return this.scoreFrom(world, from, this.player.vel);
  }

  /** Project the bot's position 8 frames forward and pick from there — gives the next-hook planning lookahead. */
  private pickTargetFromFuture(world: World): TargetPick | null {
    const future = new Vec2(
      this.player.pos.x + this.player.vel.x * 8,
      this.player.pos.y + this.player.vel.y * 8 - 60,
    );
    return this.scoreFrom(world, future, this.player.vel);
  }

  private scoreFrom(world: World, from: Vec2, vel: Vec2): TargetPick | null {
    let best: Obstacle | null = null;
    let bestScore = -Infinity;
    const minHeightAbove = 60;
    for (const o of world.obstacles) {
      if (!o.grappleable) continue;
      if (o.collected) continue;
      if (o.unstableTriggered) continue;
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const dy = cy - from.y;
      if (dy >= -minHeightAbove) continue; // must be well above
      const dx = cx - from.x;
      const dist = Math.hypot(dx, dy);
      if (dist < 50 || dist > 820) continue;
      // Score: verticality + closeness + kind bonus + alignment with current velocity (for ballistic logic).
      const verticality = -dy / Math.max(40, dist);
      let score = verticality * 220 - dist * 0.05;
      if (o.kind === 'energy') score += 90;
      else if (o.kind === 'bouncy') score += 50;
      else if (o.kind === 'drone') score -= 30;
      // Higher-skill bots weight velocity alignment so they exploit momentum.
      if (this.personality.skill > 0.55) {
        const speed = Math.hypot(vel.x, vel.y);
        if (speed > 1) {
          const dot = (vel.x * dx + vel.y * dy) / (speed * dist);
          score += dot * 60 * this.personality.skill;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    if (!best) return null;
    const cx = best.x + best.width / 2;
    const cy = best.y + best.height / 2;
    const jitter = (1 - this.personality.accuracy) * 50;
    return {
      obstacle: best,
      aim: new Vec2(cx + (Math.random() - 0.5) * jitter, cy + (Math.random() - 0.5) * jitter),
    };
  }
}
