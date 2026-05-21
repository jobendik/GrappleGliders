import { PHYSICS, Vec2, circleRect, springTension } from './Physics';
import type { Obstacle } from './World';

export type HookState = 'idle' | 'shooting' | 'attached' | 'reeling';

export interface HookShootResult {
  fired: boolean;
}

export interface HookConnectEvent {
  obstacle: Obstacle;
  position: Vec2;
  distance: number;
  perfectAnchor: boolean;
}

export class GrapplingHook {
  state: HookState = 'idle';
  position = new Vec2();
  velocity = new Vec2();
  targetDirection = new Vec2(0, -1);
  ropeLength = 0;
  attached: Obstacle | null = null;
  perfectAnchor = false;

  reset(): void {
    this.state = 'idle';
    this.position.set(0, 0);
    this.velocity.set(0, 0);
    this.ropeLength = 0;
    this.attached = null;
    this.perfectAnchor = false;
  }

  shoot(origin: Vec2, target: Vec2): HookShootResult {
    if (this.state === 'attached' || this.state === 'shooting') return { fired: false };
    const dir = new Vec2(target.x - origin.x, target.y - origin.y);
    if (dir.lenSq() < 1e-6) dir.set(0, -1);
    else dir.norm();
    // Constrain to the upper hemisphere — the hook does not fire downward.
    // Aiming below the player (e.g. tapping under the character on mobile)
    // gets clamped to a horizontal shot in the same x direction. Prevents
    // a useless downward grapple that breaks the game's vertical flow.
    if (dir.y > 0) {
      dir.y = 0;
      if (Math.abs(dir.x) < 1e-6) dir.set(0, -1);
      else dir.norm();
    }
    this.state = 'shooting';
    this.position.copy(origin);
    this.velocity.set(dir.x * PHYSICS.hookSpeed, dir.y * PHYSICS.hookSpeed);
    this.targetDirection.copy(dir);
    this.attached = null;
    this.perfectAnchor = false;
    return { fired: true };
  }

  /** Returns the connect event if the hook attached this frame. */
  step(
    dt: number,
    playerPos: Vec2,
    obstacles: ReadonlyArray<Obstacle>,
  ): HookConnectEvent | null {
    if (this.state !== 'shooting') return null;
    // Sub-step the hook's movement so a single fast frame can't tunnel
    // through a thin platform. Without this, a 52px/frame hook can skip
    // straight past a 20px-tall platform and break at max range instead.
    const dxStep = this.velocity.x * dt;
    const dyStep = this.velocity.y * dt;
    const dist = Math.hypot(dxStep, dyStep);
    const subStep = PHYSICS.hookRadius; // safe upper bound: equals collision radius
    const steps = Math.max(1, Math.ceil(dist / subStep));
    const invSteps = 1 / steps;
    for (let s = 0; s < steps; s++) {
      this.position.x += dxStep * invSteps;
      this.position.y += dyStep * invSteps;
      const rx = this.position.x - playerPos.x;
      const ry = this.position.y - playerPos.y;
      if (Math.hypot(rx, ry) > PHYSICS.hookMaxRange) {
        this.break();
        return null;
      }
      for (const obs of obstacles) {
        if (!obs.grappleable) continue;
        if (circleRect(this.position.x, this.position.y, PHYSICS.hookRadius, obs)) {
          return this.attach(obs, playerPos);
        }
      }
    }
    return null;
  }

  private attach(obs: Obstacle, playerPos: Vec2): HookConnectEvent {
    this.state = 'attached';
    this.attached = obs;
    const dist = Math.hypot(this.position.x - playerPos.x, this.position.y - playerPos.y);
    this.ropeLength = Math.max(PHYSICS.ropeMinLength, Math.min(PHYSICS.ropeMaxLength, dist));
    const cx = obs.x + obs.width / 2;
    const cy = obs.y + obs.height / 2;
    const distToCenter = Math.hypot(this.position.x - cx, this.position.y - cy);
    this.perfectAnchor = distToCenter < 10;
    return {
      obstacle: obs,
      position: this.position.clone(),
      distance: dist,
      perfectAnchor: this.perfectAnchor,
    };
  }

  break(): void {
    this.state = 'idle';
    this.attached = null;
    this.perfectAnchor = false;
  }

  /** Applies spring tension to a velocity in-place when attached. */
  applyTension(playerPos: Vec2, playerVel: Vec2, dt: number): void {
    if (this.state !== 'attached') return;
    const toAnchorX = this.position.x - playerPos.x;
    const toAnchorY = this.position.y - playerPos.y;
    const dist = Math.hypot(toAnchorX, toAnchorY);
    if (dist < 1e-3) return;
    const nx = toAnchorX / dist;
    const ny = toAnchorY / dist;

    const tension = springTension(dist, this.ropeLength, PHYSICS.ropeForce, dt);
    if (tension > 0) {
      playerVel.x += nx * tension;
      playerVel.y += ny * tension;
      const radial = playerVel.x * nx + playerVel.y * ny;
      if (radial < 0) {
        playerVel.x += nx * -radial * 0.72;
        playerVel.y += ny * -radial * 0.72;
      }
      playerVel.scale(Math.pow(PHYSICS.ropeDamping, dt));
    }
  }

  reel(direction: -1 | 0 | 1, dt: number): void {
    if (this.state !== 'attached') return;
    if (direction === -1) this.ropeLength -= PHYSICS.reelSpeed * dt;
    if (direction === 1) this.ropeLength += PHYSICS.reelSpeed * 0.78 * dt;
    if (this.ropeLength < PHYSICS.ropeMinLength) this.ropeLength = PHYSICS.ropeMinLength;
    if (this.ropeLength > PHYSICS.ropeMaxLength) this.ropeLength = PHYSICS.ropeMaxLength;
  }
}
