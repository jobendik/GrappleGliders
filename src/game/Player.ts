import { PHYSICS, Vec2 } from './Physics';
import { GrapplingHook, type HookConnectEvent } from './GrapplingHook';
import type { Obstacle, PickupKind, World } from './World';

export interface PlayerInputState {
  moveX: number;
  reel: -1 | 0 | 1;
  pointerDown: boolean;
  dashRequested: boolean;
  hookTarget: Vec2 | null;
  releaseHook: boolean;
  /**
   * Current aim point in world space, even when not firing. Used to give
   * dash a meaningful direction when the player has a finger held / mouse
   * positioned but hasn't committed to a hook shot.
   */
  aimPoint?: Vec2 | null;
}

export interface PlayerEvents {
  onHookFire: () => void;
  onHookConnect: (e: HookConnectEvent) => void;
  onHookRelease: (vel: Vec2) => void;
  onDash: () => void;
  onDeath: (cause: string) => void;
  onNearMiss: (obs: Obstacle, distance: number) => void;
  onBounce: (obs: Obstacle) => void;
  onPickup: (kind: PickupKind, obs: Obstacle) => void;
  onShieldAbsorb: () => void;
}

const DEFAULT_EVENTS: PlayerEvents = {
  onHookFire: () => undefined,
  onHookConnect: () => undefined,
  onHookRelease: () => undefined,
  onDash: () => undefined,
  onDeath: () => undefined,
  onNearMiss: () => undefined,
  onBounce: () => undefined,
  onPickup: () => undefined,
  onShieldAbsorb: () => undefined,
};

export class Player {
  pos: Vec2;
  prev: Vec2;
  vel = new Vec2();
  radius = 13;
  dead = false;
  onGround = false;
  dashCharges = PHYSICS.maxDashCharges;
  dashRecharge = 0;
  dashFlashTimer = 0;
  invuln = 0;
  hook = new GrapplingHook();
  events: PlayerEvents = DEFAULT_EVENTS;
  maxAltitude = 0;
  /** Shield charges absorbed from shield-pickup. */
  shield = 0;
  /** Frames remaining for the magnet pickup effect. */
  magnetFrames = 0;
  /** Tracks near-miss debounce per obstacle id. */
  private nearMissed = new Set<number>();

  constructor(x: number, y: number) {
    this.pos = new Vec2(x, y);
    this.prev = this.pos.clone();
  }

  setEvents(events: Partial<PlayerEvents>): void {
    this.events = { ...DEFAULT_EVENTS, ...events };
  }

  reset(x: number, y: number): void {
    this.pos.set(x, y);
    this.prev.copy(this.pos);
    this.vel.set(0, 0);
    this.dead = false;
    this.onGround = false;
    this.dashCharges = PHYSICS.maxDashCharges;
    this.dashRecharge = 0;
    this.dashFlashTimer = 0;
    this.invuln = 0;
    this.hook.reset();
    this.maxAltitude = 0;
    this.shield = 0;
    this.magnetFrames = 0;
    this.nearMissed.clear();
  }

  update(dt: number, input: PlayerInputState, world: World, killY: number): void {
    if (this.dead) return;
    this.prev.copy(this.pos);
    this.onGround = false;

    this.vel.x += input.moveX * PHYSICS.strafeForce * dt;
    this.vel.y += PHYSICS.gravity * dt;
    this.vel.scale(Math.pow(PHYSICS.airDrag, dt));

    // Fire hook
    if (input.hookTarget) {
      const result = this.hook.shoot(this.pos, input.hookTarget);
      if (result.fired) {
        this.events.onHookFire();
      }
    }
    if (input.releaseHook && this.hook.state === 'attached') {
      this.vel.scale(PHYSICS.releaseBoost);
      this.events.onHookRelease(this.vel);
      this.hook.break();
    }

    // Hook physics
    if (this.hook.state === 'shooting') {
      const ev = this.hook.step(dt, this.pos, world.obstacles);
      if (ev) {
        if (ev.obstacle.kind === 'unstable') world.triggerUnstable(ev.obstacle);
        this.events.onHookConnect(ev);
      }
    } else if (this.hook.state === 'attached' && this.hook.attached) {
      const obs = this.hook.attached;
      // If the unstable platform we grabbed has been removed, break.
      if (obs.unstableTriggered && obs.unstableTimer > 24) {
        this.hook.break();
      } else {
        if (obs.kind === 'drone') {
          // Hook moves with the drifting drone.
          const dx = obs.x - obs.lastX;
          this.hook.position.x += dx;
        }
        if (input.pointerDown) this.hook.reel(-1, dt);
        else if (input.reel !== 0) this.hook.reel(input.reel, dt);
        this.hook.applyTension(this.pos, this.vel, dt);

        // Tangent input from horizontal movement
        if (input.moveX !== 0) {
          const toAnchorX = this.hook.position.x - this.pos.x;
          const toAnchorY = this.hook.position.y - this.pos.y;
          const dist = Math.hypot(toAnchorX, toAnchorY);
          if (dist > 1e-3) {
            const nx = toAnchorX / dist;
            const ny = toAnchorY / dist;
            this.vel.x += -ny * input.moveX * 0.12 * dt;
            this.vel.y += nx * input.moveX * 0.12 * dt;
          }
        }
      }
    }

    // Clamp speed
    const speed = this.vel.len();
    if (speed > PHYSICS.maxSpeed) this.vel.scale(PHYSICS.maxSpeed / speed);

    // Dash. Direction priority on mobile/desktop alike:
    //   1. Explicit hookTarget (just-fired shot direction)
    //   2. Current aim point (finger held / mouse positioned)
    //   3. Velocity direction if moving fast enough (forward boost)
    //   4. Straight up (fallback for a stationary player)
    if (input.dashRequested && this.dashCharges > 0 && this.hook.state !== 'attached') {
      const dir = new Vec2(0, -1);
      const aim = input.hookTarget ?? input.aimPoint ?? null;
      if (aim) {
        dir.set(aim.x - this.pos.x, aim.y - this.pos.y);
        if (dir.lenSq() < 1e-3) dir.set(0, -1);
        else dir.norm();
      } else if (this.vel.lenSq() > 40) {
        dir.set(this.vel.x, this.vel.y).norm();
      }
      this.vel.x += dir.x * PHYSICS.dashSpeed;
      this.vel.y += dir.y * PHYSICS.dashSpeed;
      this.dashCharges -= 1;
      this.dashFlashTimer = 14;
      this.invuln = Math.max(this.invuln, 10);
      this.events.onDash();
    }
    if (this.dashFlashTimer > 0) this.dashFlashTimer -= dt;

    // Integrate position
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // Solid collisions: only platforms and bouncy panels stop the player.
    this.resolveCollisions(world);

    // Near-miss + lethal checks
    this.checkObstacleInteractions(world);

    // Dash recharge — only while the hook is attached. Forces the player to
    // engage the grappling hook to refill dashes instead of dash-spamming up.
    if (this.dashCharges < PHYSICS.maxDashCharges) {
      if (this.hook.state === 'attached') {
        this.dashRecharge += dt;
        if (this.dashRecharge >= PHYSICS.dashCooldownFrames) {
          this.dashCharges += 1;
          this.dashRecharge = 0;
        }
      }
    } else {
      this.dashRecharge = PHYSICS.dashCooldownFrames;
    }

    if (this.invuln > 0) this.invuln -= dt;
    if (this.magnetFrames > 0) this.magnetFrames -= dt;

    // Lava / kill line
    if (this.pos.y > killY - this.radius * 0.6) {
      if (this.shield > 0) {
        this.shield -= 1;
        // Knock the player back up so they don't insta-die after spending the shield.
        this.pos.y = killY - this.radius * 4;
        this.vel.y = -12;
        this.invuln = 30;
        this.events.onShieldAbsorb();
      } else {
        this.die('Consumed by the lava');
        return;
      }
    }

    // Track altitude (negative Y is up)
    const alt = -this.pos.y / 10;
    if (alt > this.maxAltitude) this.maxAltitude = alt;
  }

  private resolveCollisions(world: World): void {
    for (const o of world.obstacles) {
      if (!o.grappleable && !o.lethal) continue;
      if (o.kind === 'energy' || o.kind === 'drone') continue;
      // Simple circle-vs-rect with vertical resolution preference
      const dx = this.pos.x - Math.max(o.x, Math.min(this.pos.x, o.x + o.width));
      const dy = this.pos.y - Math.max(o.y, Math.min(this.pos.y, o.y + o.height));
      const distSq = dx * dx + dy * dy;
      if (distSq < this.radius * this.radius) {
        if (o.lethal) continue; // handled in checkObstacleInteractions
        const dist = Math.sqrt(distSq) || 1e-3;
        const nx = dx / dist;
        const ny = dy / dist;
        const penetration = this.radius - dist;
        this.pos.x += nx * penetration;
        this.pos.y += ny * penetration;
        const dot = this.vel.x * nx + this.vel.y * ny;
        if (dot < 0) {
          if (o.bouncy) {
            this.vel.x -= 2 * dot * nx;
            this.vel.y -= 2 * dot * ny;
            this.vel.scale(1.18);
            this.events.onBounce(o);
          } else {
            this.vel.x -= dot * nx;
            this.vel.y -= dot * ny;
            this.vel.scale(0.86);
          }
        }
        if (ny < -0.5) this.onGround = true;
      }
    }
  }

  private checkObstacleInteractions(world: World): void {
    const seenIds = new Set<number>();
    const magnetRadius = this.magnetFrames > 0 ? 140 : 0;
    for (const o of world.obstacles) {
      if (o.collected) continue;
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const dx = this.pos.x - cx;
      const dy = this.pos.y - cy;
      const dist = Math.hypot(dx, dy);

      // Pickup collection: physical touch, plus magnet pull-in radius for sparks.
      if (o.pickup) {
        const pickupDist = this.radius + Math.max(o.width, o.height) / 2;
        if (
          dist < pickupDist ||
          (o.kind === 'spark' && magnetRadius > 0 && dist < magnetRadius)
        ) {
          o.collected = true;
          if (o.kind === 'shield-pickup') this.shield = Math.min(2, this.shield + 1);
          if (o.kind === 'magnet-pickup') this.magnetFrames = Math.max(this.magnetFrames, 360);
          this.events.onPickup(o.kind as PickupKind, o);
          continue;
        }
      }

      if (o.lethal && dist < this.radius + Math.max(o.width, o.height) / 2 && this.invuln <= 0) {
        // Tight rect test for spikes
        const insideX = this.pos.x > o.x - this.radius && this.pos.x < o.x + o.width + this.radius;
        const insideY = this.pos.y > o.y - this.radius && this.pos.y < o.y + o.height + this.radius;
        if (insideX && insideY) {
          if (this.shield > 0) {
            this.shield -= 1;
            this.invuln = 40;
            this.vel.y = -10;
            this.events.onShieldAbsorb();
            continue;
          }
          this.die('Impaled on spikes');
          return;
        }
      }

      // Near-miss: within 30px of obstacle edge but not touching
      if (o.grappleable && dist < 40 + this.radius && dist > this.radius + 6) {
        if (!this.nearMissed.has(o.id) && this.vel.len() > 6) {
          this.nearMissed.add(o.id);
          this.events.onNearMiss(o, dist);
        }
        seenIds.add(o.id);
      }
    }
    // Allow re-trigger after the player moves away.
    for (const id of [...this.nearMissed]) {
      if (!seenIds.has(id)) this.nearMissed.delete(id);
    }
  }

  die(cause: string): void {
    if (this.dead) return;
    this.dead = true;
    this.hook.reset();
    this.events.onDeath(cause);
  }

  revive(): void {
    if (!this.dead) return;
    this.dead = false;
    this.vel.set(0, -8);
    this.pos.y -= 80;
    this.invuln = 80;
    this.hook.reset();
  }
}
