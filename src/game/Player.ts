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
  /**
   * When true, the rope is gently reeled in automatically (mobile gamefeel).
   * Has lower priority than explicit reel input or pointerDown reel.
   */
  autoReel?: boolean;
  /**
   * True only on the frame the pointer (or screen tap) was pressed.
   * Drives the pendulum-mode tap-to-release.
   */
  tapJustPressed?: boolean;
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
  dashCharges: number = PHYSICS.maxDashCharges;
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
  /**
   * When true the player uses the slingshot mechanic: on collision with a
   * peg the player locks onto it; the next pointer-drag is captured as an
   * aim vector and released as an impulse. Bots leave this false and keep
   * the projectile hook model.
   */
  useSling = false;
  /** Drag anchor in world space (set when pointer goes down while loaded). */
  slingAimAnchor: Vec2 | null = null;
  /** Current pull vector in world px (positive components = pull direction). */
  slingCurrentDrag = new Vec2();
  /** True while the player is mid-aim — read by the renderer for the band/preview. */
  slingAiming = false;
  /** World position of the last peg attach — used by the soft-respawn fall recovery. */
  lastAttachPos = new Vec2();
  /** True once any attach has happened — gates fall-recovery. */
  hasAttached = false;
  /** When enabled, idle attached swings get a gentle auto-pump for Easy Mode. */
  easyModeAssist = false;
  /** Strength of the last timing-based launch burst, 0..1. */
  lastReleaseBurst = 0;
  /** True when the previous release landed in the perfect-launch window. */
  lastReleasePerfect = false;
  /** Brief airborne window where a launch burst can exceed the normal speed cap. */
  launchBoostFrames = 0;
  /** Per-player snap radius so Easy Mode can be more forgiving without affecting Classic. */
  slingAttachRange: number = PHYSICS.slingAttachRange;
  /** Per-player release tuning so assisted mode gets a punchier launch. */
  tapReleaseBoost: number = PHYSICS.tapReleaseBoost;
  tapReleaseMinUpwardVel: number = PHYSICS.tapReleaseMinUpwardVel;
  /**
   * Frames remaining after an attach during which a tap-release is ignored.
   * Prevents the same tap that caused the snap (or a finger still resting on
   * screen) from accidentally launching the player off the peg instantly.
   */
  attachLockout = 0;
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
    this.slingAimAnchor = null;
    this.slingCurrentDrag.set(0, 0);
    this.slingAiming = false;
    this.lastAttachPos.set(x, y);
    this.hasAttached = false;
    this.attachLockout = 0;
    this.lastReleaseBurst = 0;
    this.lastReleasePerfect = false;
    this.launchBoostFrames = 0;
  }

  update(dt: number, input: PlayerInputState, world: World, killY: number): void {
    if (this.dead) return;
    this.prev.copy(this.pos);
    this.onGround = false;

    // Tick the reattach cooldown every frame.
    this.hook.updateCooldown(dt);

    if (this.useSling) {
      this.updateSling(dt, input, world, killY);
      return;
    }

    // ---- Legacy projectile hook model (bots only) ----
    this.vel.x += input.moveX * PHYSICS.strafeForce * dt;
    this.vel.y += PHYSICS.gravity * dt;
    this.vel.scale(Math.pow(PHYSICS.airDrag, dt));

    if (input.hookTarget) {
      const result = this.hook.shoot(this.pos, input.hookTarget);
      if (result.fired) this.events.onHookFire();
    }

    if (input.releaseHook && this.hook.state === 'attached') {
      this.vel.scale(PHYSICS.releaseBoost);
      this.events.onHookRelease(this.vel);
      this.hook.break();
    }

    if (this.hook.state === 'shooting') {
      const ev = this.hook.step(dt, this.pos, world.obstacles);
      if (ev) {
        if (ev.obstacle.kind === 'unstable') world.triggerUnstable(ev.obstacle);
        this.events.onHookConnect(ev);
      }
    } else if (this.hook.state === 'attached' && this.hook.attached) {
      const obs = this.hook.attached;
      if (obs.unstableTriggered && obs.unstableTimer > 24) {
        this.hook.break();
      } else {
        if (obs.kind === 'drone') {
          const dx = obs.x - obs.lastX;
          this.hook.position.x += dx;
        }
        if (input.pointerDown) this.hook.reel(-1, dt);
        else if (input.reel !== 0) this.hook.reel(input.reel, dt);
        else if (input.autoReel) {
          this.hook.ropeLength = Math.max(
            PHYSICS.ropeMinLength,
            this.hook.ropeLength - PHYSICS.autoReelSpeed * dt,
          );
        }
        this.hook.applyTension(this.pos, this.vel, dt);

        if (input.moveX !== 0) {
          const toAnchorX = this.hook.position.x - this.pos.x;
          const toAnchorY = this.hook.position.y - this.pos.y;
          const dist = Math.hypot(toAnchorX, toAnchorY);
          if (dist > 1e-3) {
            const nx = toAnchorX / dist;
            const ny = toAnchorY / dist;
            const force = 0.12;
            this.vel.x += -ny * input.moveX * force * dt;
            this.vel.y += nx * input.moveX * force * dt;
          }
        }
      }
    }

    const speed = this.vel.len();
    if (speed > PHYSICS.maxSpeed) this.vel.scale(PHYSICS.maxSpeed / speed);

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

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    this.resolveCollisions(world);
    this.checkObstacleInteractions(world);

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

    if (this.pos.y > killY - this.radius * 0.6) {
      if (this.shield > 0) {
        this.shield -= 1;
        this.pos.y = killY - this.radius * 4;
        this.vel.y = -12;
        this.invuln = 30;
        this.events.onShieldAbsorb();
      } else {
        this.die('Consumed by the lava');
        return;
      }
    }

    const alt = -this.pos.y / 10;
    if (alt > this.maxAltitude) this.maxAltitude = alt;
  }

  /**
   * Pendulum-swing update path (Talking Tom Go Up style).
   *
   * Flying: gravity + light air control, snaps onto a peg when in range.
   * Attached: the player hangs from a fixed-length rope and swings as a
   * pendulum under gravity. Left/right steering pumps the swing. A single
   * tap releases the player with their current velocity plus a guaranteed
   * upward boost — so the next peg is always reachable.
   */
  private updateSling(dt: number, input: PlayerInputState, world: World, killY: number): void {
    if (this.attachLockout > 0) this.attachLockout -= dt;
    if (this.launchBoostFrames > 0) this.launchBoostFrames = Math.max(0, this.launchBoostFrames - dt);
    if (this.dashFlashTimer > 0) this.dashFlashTimer -= dt;

    // ATTACHED: pendulum swinging on the rope.
    if (this.hook.state === 'attached' && this.hook.attached) {
      this.launchBoostFrames = 0;
      const obs = this.hook.attached;
      // Move with the peg if it's a drone (anchor follows the drone's drift).
      if (obs.kind === 'drone') {
        const dx = obs.x - obs.lastX;
        this.hook.position.x += dx;
      }
      // Crumbling unstable peg — kicked free with a small upward nudge.
      if (obs.unstableTriggered && obs.unstableTimer > 24) {
        this.vel.set(0, -8);
        this.hook.break();
        this.attachLockout = 0;
        return;
      }

      // Pendulum basis vectors for release timing and steering force.
      const toAnchorX = this.hook.position.x - this.pos.x;
      const toAnchorY = this.hook.position.y - this.pos.y;
      const distToAnchor = Math.hypot(toAnchorX, toAnchorY) || 1e-3;
      const nx = toAnchorX / distToAnchor;
      const ny = toAnchorY / distToAnchor;
      // Tangent (rotate the anchor-direction 90° CCW). With the anchor above
      // (nx≈0, ny≈-1), tangent points to +x, so moveX=+1 pushes right.
      const tangentX = -ny;
      const tangentY = nx;

      if (input.dashRequested && this.dashCharges > 0) {
        if (this.vel.y > -this.tapReleaseMinUpwardVel * 0.7) {
          this.vel.y = -this.tapReleaseMinUpwardVel * 0.7;
        }
        this.lastAttachPos.copy(this.pos);
        this.hook.break();
        this.attachLockout = 0;
        this.applyDash(input, true);
        return;
      }

      // Tap-to-release. Once the attach-lockout window has elapsed, any new
      // pointer press launches the player off the peg with their current
      // swing velocity plus a guaranteed upward boost.
      if (input.tapJustPressed && this.attachLockout <= 0) {
        const speedBeforeRelease = this.vel.len();
        const horizontalness = speedBeforeRelease > 1e-3 ? Math.abs(this.vel.x) / speedBeforeRelease : 0;
        const bottomness = Math.max(0, Math.min(1, (-ny - 0.8) / 0.2));
        const speediness = Math.max(
          0,
          Math.min(
            1,
            (speedBeforeRelease - PHYSICS.slingLaunchSpeedThreshold) /
              14,
          ),
        );
        const burst = bottomness * horizontalness * speediness;
        this.lastReleaseBurst = burst;
        this.lastReleasePerfect = burst >= PHYSICS.slingPerfectReleaseThreshold;
        if (burst > 0 && speedBeforeRelease > 1e-3) {
          const invSpeed = 1 / speedBeforeRelease;
          this.vel.x += this.vel.x * invSpeed * PHYSICS.slingLaunchForwardBoost * burst;
          this.vel.y += this.vel.y * invSpeed * PHYSICS.slingLaunchForwardBoost * burst * 0.28;
          this.launchBoostFrames = PHYSICS.slingLaunchBoostFrames * (0.55 + burst * 0.45);
        }
        this.vel.y -= this.tapReleaseBoost;
        if (this.vel.y > -this.tapReleaseMinUpwardVel) {
          this.vel.y = -this.tapReleaseMinUpwardVel;
        }
        if (burst > 0) this.vel.y -= PHYSICS.slingLaunchUpwardBoost * burst;
        const releaseSpeed = this.vel.len();
        const releaseCap = this.launchBoostFrames > 0 ? PHYSICS.slingLaunchMaxSpeed : PHYSICS.maxSpeed;
        if (releaseSpeed > releaseCap) {
          this.vel.scale(releaseCap / releaseSpeed);
        }
        this.lastAttachPos.copy(this.pos);
        this.events.onHookRelease(this.vel);
        this.hook.break();
        return;
      }

      // Pendulum physics: gravity + optional tangential steering input + damping.
      let swingInput = input.moveX;
      if (swingInput === 0 && this.easyModeAssist) {
        // Easy Mode keeps the pendulum building even when the player isn't
        // steering, matching the settings copy and preventing dead-hangs.
        if (Math.abs(this.vel.x) > 0.45) {
          swingInput = this.vel.x > 0 ? 1 : -1;
        } else {
          const ropeDx = this.pos.x - this.hook.position.x;
          swingInput = ropeDx > 6 ? 1 : ropeDx < -6 ? -1 : 1;
        }
      }

      if (swingInput !== 0) {
        this.vel.x += tangentX * swingInput * PHYSICS.swingTangentForce * dt;
        this.vel.y += tangentY * swingInput * PHYSICS.swingTangentForce * dt;
      }
      this.vel.y += PHYSICS.gravity * dt;
      this.vel.scale(Math.pow(PHYSICS.pendulumDamping, dt));

      // Integrate position, then constrain to a rigid rod at ropeLength.
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      this.hook.applyRigidConstraint(this.pos, this.vel, dt);

      const speed = this.vel.len();
      if (speed > PHYSICS.maxSpeed) this.vel.scale(PHYSICS.maxSpeed / speed);

      // Pickups still get consumed while attached (e.g. magnet pulls sparks in).
      this.checkPickupsOnly(world);
      this.updateDashRecharge(dt);
      if (this.invuln > 0) this.invuln -= dt;
      if (this.magnetFrames > 0) this.magnetFrames -= dt;

      if (this.pos.y > killY - this.radius * 0.6) {
        if (this.shield > 0) {
          this.shield -= 1;
          this.pos.y = killY - this.radius * 4;
          this.vel.y = -12;
          this.invuln = 30;
          this.events.onShieldAbsorb();
        } else {
          this.die('Consumed by the lava');
          return;
        }
      }

      const alt = -this.pos.y / 10;
      if (alt > this.maxAltitude) this.maxAltitude = alt;
      return;
    }

    // IDLE / FLYING.
    // Mild air control — useful for fine corrections, weaker than the legacy strafe.
    this.vel.x += input.moveX * PHYSICS.strafeForce * 0.5 * dt;
    this.vel.y += PHYSICS.gravity * dt;
    this.vel.scale(Math.pow(PHYSICS.airDrag, dt));

    if (input.dashRequested && this.dashCharges > 0) {
      this.applyDash(input, false);
    }

    const speed = this.vel.len();
    const speedCap = this.launchBoostFrames > 0 ? PHYSICS.slingLaunchMaxSpeed : PHYSICS.maxSpeed;
    if (speed > speedCap) this.vel.scale(speedCap / speed);

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // Try to snap onto a peg *before* resolving collisions — otherwise the
    // player would bounce off the platform edge before the auto-attach can
    // capture them. tryAutoSling already excludes bouncy panels.
    if (this.hook.state === 'idle') {
      const ev = this.hook.tryAutoSling(
        this.pos,
        world.obstacles,
        this.slingAttachRange,
      );
      if (ev) {
        // Project the player onto the rope circle so the rope length is
        // consistent on attach. Preserve tangential velocity (kill the
        // radial component) so the entry momentum carries into the swing.
        const ropeLen = this.hook.ropeLength;
        const dxToPeg = this.pos.x - this.hook.position.x;
        const dyToPeg = this.pos.y - this.hook.position.y;
        const dist = Math.hypot(dxToPeg, dyToPeg);
        if (dist < 1e-3) {
          // Standing right on the anchor — drop straight down with a small
          // sideways kick from prior velocity so the pendulum starts.
          this.pos.set(this.hook.position.x, this.hook.position.y + ropeLen);
          this.vel.x = this.vel.x * 0.5;
          this.vel.y = 0;
        } else {
          const scale = ropeLen / dist;
          this.pos.x = this.hook.position.x + dxToPeg * scale;
          this.pos.y = this.hook.position.y + dyToPeg * scale;
          // Project velocity onto the tangent.
          const ux = dxToPeg / dist;
          const uy = dyToPeg / dist;
          const radial = this.vel.x * ux + this.vel.y * uy;
          this.vel.x -= ux * radial;
          this.vel.y -= uy * radial;
        }
        this.prev.copy(this.pos);
        this.attachLockout = PHYSICS.tapReleaseAttachLockout;
        this.lastAttachPos.copy(this.pos);
        this.hasAttached = true;
        if (ev.obstacle.kind === 'unstable') world.triggerUnstable(ev.obstacle);
        this.events.onHookConnect(ev);
      }
    }

    // Bouncy-only collision pass — platforms/energy/drones are snap targets,
    // not solid walls in sling mode. Falling through a missed peg is correct
    // behavior; the player either snaps to the next peg or falls past.
    if (this.hook.state === 'idle') {
      this.resolveBouncyOnly(world);
    }

    this.checkSlingInteractions(world);
    this.updateDashRecharge(dt);

    if (this.invuln > 0) this.invuln -= dt;
    if (this.magnetFrames > 0) this.magnetFrames -= dt;

    // Kill line only fires when Game.ts has set killY into a reachable range.
    // Non-hazard modes park it far below the player.
    if (this.pos.y > killY - this.radius * 0.6) {
      if (this.shield > 0) {
        this.shield -= 1;
        this.pos.y = killY - this.radius * 4;
        this.vel.y = -12;
        this.invuln = 30;
        this.events.onShieldAbsorb();
      } else {
        this.die('Consumed by the lava');
        return;
      }
    }

    const alt = -this.pos.y / 10;
    if (alt > this.maxAltitude) this.maxAltitude = alt;
  }

  private applyDash(input: PlayerInputState, forceUpwardBias: boolean): void {
    if (this.dashCharges <= 0) return;
    const dir = new Vec2(0, -1);
    const aim = input.aimPoint ?? input.hookTarget ?? null;
    if (aim) {
      dir.set(aim.x - this.pos.x, aim.y - this.pos.y);
      if (dir.lenSq() < 1e-3) dir.set(0, -1);
      else dir.norm();
    } else if (this.vel.lenSq() > 40) {
      dir.set(this.vel.x, this.vel.y).norm();
    }
    if (forceUpwardBias || dir.y > -0.18) {
      dir.y -= forceUpwardBias ? 0.8 : 0.55;
      dir.norm();
    }
    this.vel.x += dir.x * PHYSICS.dashSpeed;
    this.vel.y += dir.y * PHYSICS.dashSpeed;
    this.dashCharges -= 1;
    this.dashRecharge = 0;
    this.dashFlashTimer = 14;
    this.invuln = Math.max(this.invuln, 12);
    this.launchBoostFrames = Math.max(this.launchBoostFrames, PHYSICS.slingLaunchBoostFrames * 0.55);
    this.events.onDash();
  }

  private updateDashRecharge(dt: number): void {
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
  }

  private clearSlingAim(): void {
    this.slingAimAnchor = null;
    this.slingCurrentDrag.set(0, 0);
    this.slingAiming = false;
  }

  /** Soft respawn the player back to the last peg they attached to. */
  recoverToLastPeg(): void {
    this.pos.copy(this.lastAttachPos);
    this.prev.copy(this.pos);
    this.vel.set(0, 0);
    this.hook.reset();
    this.clearSlingAim();
    this.attachLockout = 0;
    this.invuln = PHYSICS.slingHazardInvuln;
  }

  /** Pickup-only sweep used while the player is locked on a peg. */
  private checkPickupsOnly(world: World): void {
    const magnetRadius = this.magnetFrames > 0 ? 140 : 0;
    for (const o of world.obstacles) {
      if (o.collected) continue;
      if (!o.pickup) continue;
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const dx = this.pos.x - cx;
      const dy = this.pos.y - cy;
      const dist = Math.hypot(dx, dy);
      const pickupDist = this.radius + Math.max(o.width, o.height) / 2;
      if (
        dist < pickupDist ||
        (o.kind === 'spark' && magnetRadius > 0 && dist < magnetRadius)
      ) {
        o.collected = true;
        if (o.kind === 'shield-pickup') this.shield = Math.min(2, this.shield + 1);
        if (o.kind === 'magnet-pickup') this.magnetFrames = Math.max(this.magnetFrames, 360);
        this.events.onPickup(o.kind as PickupKind, o);
      }
    }
  }

  /**
   * Pickups + non-lethal hazard knockback while flying in sling mode.
   * Spikes bounce the player away with a short invuln window instead of
   * killing — the lose condition in sling mode is "fall off the screen".
   */
  private checkSlingInteractions(world: World): void {
    const seenIds = new Set<number>();
    const magnetRadius = this.magnetFrames > 0 ? 140 : 0;
    for (const o of world.obstacles) {
      if (o.collected) continue;
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const dx = this.pos.x - cx;
      const dy = this.pos.y - cy;
      const dist = Math.hypot(dx, dy);

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
        const insideX = this.pos.x > o.x - this.radius && this.pos.x < o.x + o.width + this.radius;
        const insideY = this.pos.y > o.y - this.radius && this.pos.y < o.y + o.height + this.radius;
        if (insideX && insideY) {
          if (this.shield > 0) {
            this.shield -= 1;
            this.invuln = PHYSICS.slingHazardInvuln;
            this.vel.y = -10;
            this.events.onShieldAbsorb();
            continue;
          }
          // Soft knockback — push the player back the way they came, brief invuln.
          const invDist = 1 / (dist || 1);
          const nx = dx * invDist;
          const ny = dy * invDist;
          this.vel.x = nx * 14;
          this.vel.y = ny * 14 - 4;
          this.invuln = PHYSICS.slingHazardInvuln;
          this.events.onBounce(o);
          continue;
        }
      }

      if (o.grappleable && dist < 40 + this.radius && dist > this.radius + 6) {
        if (!this.nearMissed.has(o.id) && this.vel.len() > 6) {
          this.nearMissed.add(o.id);
          this.events.onNearMiss(o, dist);
        }
        seenIds.add(o.id);
      }
    }
    for (const id of [...this.nearMissed]) {
      if (!seenIds.has(id)) this.nearMissed.delete(id);
    }
  }

  /**
   * Sling-mode collision pass: only bouncy panels apply a physical bounce.
   * Platforms, energy nodes, drones, and unstable platforms are snap-attach
   * targets and should be passed through cleanly when not snapping.
   */
  private resolveBouncyOnly(world: World): void {
    for (const o of world.obstacles) {
      if (!o.bouncy) continue;
      const dx = this.pos.x - Math.max(o.x, Math.min(this.pos.x, o.x + o.width));
      const dy = this.pos.y - Math.max(o.y, Math.min(this.pos.y, o.y + o.height));
      const distSq = dx * dx + dy * dy;
      if (distSq < this.radius * this.radius) {
        const dist = Math.sqrt(distSq) || 1e-3;
        const nx = dx / dist;
        const ny = dy / dist;
        const penetration = this.radius - dist;
        this.pos.x += nx * penetration;
        this.pos.y += ny * penetration;
        const dot = this.vel.x * nx + this.vel.y * ny;
        if (dot < 0) {
          this.vel.x -= 2 * dot * nx;
          this.vel.y -= 2 * dot * ny;
          this.vel.scale(1.18);
          this.events.onBounce(o);
        }
      }
    }
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
