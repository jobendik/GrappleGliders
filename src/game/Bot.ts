import { Vec2 } from './Physics';
import { Player, type PlayerInputState } from './Player';
import type { Obstacle, World } from './World';

export interface BotPersonality {
  name: string;
  color: string;
  reactionFrames: number; // higher = slower decisions
  aggression: number; // 0..1, dictates how often it dashes
  accuracy: number; // 0..1, scales target jitter
  skill: number; // 0..1, scales speed bonus
}

export const BOT_PERSONALITIES: BotPersonality[] = [
  { name: 'Sparky', color: '#ff9d2e', reactionFrames: 14, aggression: 0.2, accuracy: 0.5, skill: 0.45 },
  { name: 'Phase', color: '#a45cff', reactionFrames: 8, aggression: 0.45, accuracy: 0.72, skill: 0.7 },
  { name: 'Apex', color: '#ff255e', reactionFrames: 4, aggression: 0.8, accuracy: 0.92, skill: 1.0 },
];

export class Bot {
  player: Player;
  personality: BotPersonality;
  private reaction = 0;
  private cachedTarget: Vec2 | null = null;
  private lastReleaseFrame = -999;

  constructor(personality: BotPersonality, startX: number, startY: number) {
    this.personality = personality;
    this.player = new Player(startX, startY);
    this.player.radius = 12;
  }

  reset(x: number, y: number): void {
    this.player.reset(x, y);
    this.reaction = 0;
    this.cachedTarget = null;
    this.lastReleaseFrame = -999;
  }

  update(dt: number, world: World, killY: number, frame: number): void {
    if (this.player.dead) return;
    this.reaction += dt;
    if (this.reaction >= this.personality.reactionFrames || !this.cachedTarget) {
      this.cachedTarget = this.pickTarget(world);
      this.reaction = 0;
    }

    const input: PlayerInputState = {
      moveX: 0,
      reel: 0,
      pointerDown: false,
      dashRequested: false,
      hookTarget: null,
      releaseHook: false,
    };

    if (this.cachedTarget) {
      if (this.player.hook.state === 'idle') {
        input.hookTarget = this.cachedTarget;
      } else if (this.player.hook.state === 'attached') {
        // Pump the swing: reel in while the player is below the anchor, release when launched.
        const aboveHook =
          this.player.hook.position.y > this.player.pos.y && this.player.vel.y < 0;
        input.pointerDown = !aboveHook;
        const movingUpStrongly = this.player.vel.y < -5;
        const swingSideways = Math.abs(this.player.vel.x) > 4;
        if (movingUpStrongly && swingSideways && frame - this.lastReleaseFrame > 20) {
          input.releaseHook = true;
          this.lastReleaseFrame = frame;
          this.cachedTarget = null; // force a new pick next frame
        }
      }
    }

    // Occasional dash boost when low on options or under pressure from lava.
    const lavaPressure = killY - this.player.pos.y;
    if (
      this.player.dashCharges > 0 &&
      lavaPressure < 280 &&
      Math.random() < this.personality.aggression * 0.04
    ) {
      input.dashRequested = true;
      if (!input.hookTarget) input.hookTarget = new Vec2(this.player.pos.x, this.player.pos.y - 200);
    }

    this.player.update(dt, input, world, killY);
  }

  private pickTarget(world: World): Vec2 | null {
    let best: Obstacle | null = null;
    let bestScore = -Infinity;
    for (const o of world.obstacles) {
      if (!o.grappleable) continue;
      if (o.y >= this.player.pos.y - 40) continue; // must be above
      const dx = o.x + o.width / 2 - this.player.pos.x;
      const dy = o.y + o.height / 2 - this.player.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 800) continue;
      // Prefer obstacles closer to straight up; prefer energy nodes.
      const verticality = -dy / Math.max(40, dist);
      const kindBonus = o.kind === 'energy' ? 80 : o.kind === 'bouncy' ? 40 : 0;
      const score = verticality * 200 + kindBonus - dist * 0.04;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    if (!best) return null;
    const cx = best.x + best.width / 2;
    const cy = best.y + best.height / 2;
    const jitter = (1 - this.personality.accuracy) * 60;
    return new Vec2(cx + (Math.random() - 0.5) * jitter, cy + (Math.random() - 0.5) * jitter);
  }
}
