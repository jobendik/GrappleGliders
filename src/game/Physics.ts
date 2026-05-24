/**
 * Vector2 — mutable 2D vector. The hot loop reuses instances; never allocate inside update().
 */
export class Vec2 {
  constructor(
    public x: number = 0,
    public y: number = 0,
  ) {}

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v: Vec2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  add(v: Vec2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v: Vec2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  len(): number {
    return Math.hypot(this.x, this.y);
  }

  lenSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  norm(): this {
    const l = this.len();
    if (l > 1e-6) {
      this.x /= l;
      this.y /= l;
    }
    return this;
  }

  static add(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x + b.x, a.y + b.y);
  }

  static sub(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x - b.x, a.y - b.y);
  }

  static scale(a: Vec2, s: number): Vec2 {
    return new Vec2(a.x * s, a.y * s);
  }

  static dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y;
  }

  static dist(a: Vec2, b: Vec2): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  static distSq(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  static fromAngle(angle: number, speed: number = 1): Vec2 {
    return new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const circleRect = (cx: number, cy: number, r: number, rect: Rect): boolean => {
  const dx = cx - Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const dy = cy - Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  return dx * dx + dy * dy < r * r;
};

export const rectIntersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const distancePointToRectCenter = (cx: number, cy: number, rect: Rect): number => {
  const rx = rect.x + rect.width / 2;
  const ry = rect.y + rect.height / 2;
  return Math.hypot(cx - rx, cy - ry);
};

/**
 * Spring-rope tension: returns the radial impulse magnitude to apply along the rope when stretched.
 * Pure function — easy to unit test in isolation.
 */
export const springTension = (
  distance: number,
  restLength: number,
  ropeForce: number,
  dt: number,
): number => {
  if (distance <= restLength) return 0;
  return (distance - restLength) * ropeForce * dt;
};

/**
 * Combined gravity + linear drag step. Returns new velocity for a single axis.
 */
export const integrateVelocity = (
  v: number,
  acceleration: number,
  drag: number,
  dt: number,
): number => (v + acceleration * dt) * Math.pow(drag, dt);

export const PHYSICS = Object.freeze({
  gravity: 0.43,
  airDrag: 0.991,
  strafeForce: 0.34,
  maxSpeed: 42,
  hookSpeed: 52,
  hookMaxRange: 980,
  hookRadius: 8,
  ropeForce: 0.035,
  ropeDamping: 0.996,
  reelSpeed: 5.1,
  /** Slow passive reel-in applied automatically on mobile when the hook is attached. */
  autoReelSpeed: 2.5,
  ropeMinLength: 54,
  ropeMaxLength: 980,
  releaseBoost: 1.12,
  dashSpeed: 19.5,
  dashCooldownFrames: 86,
  maxDashCharges: 2,
  /** Radius within which the player auto-attaches to a grapple point (spin-and-release mechanic). */
  orbitAttachRange: 210,
  /** Frames before the player can re-attach to the same obstacle after detaching. */
  orbitReattachCooldown: 35,

  // ---- Pendulum-swing mechanic (Talking Tom Go Up style) ----
  /** Pixel radius for auto-snap onto the nearest peg while flying. */
  slingAttachRange: 80,
  /** Fixed rope length the character hangs from when snapped to a peg. */
  pendulumRopeLength: 70,
  /** Per-frame multiplicative damping applied to swing velocity (1.0 = no loss). */
  pendulumDamping: 0.9985,
  /** Tangential acceleration added when the player steers left/right while attached. */
  swingTangentForce: 0.22,
  /** Upward velocity boost added to current velocity on tap-release. */
  tapReleaseBoost: 8,
  /** Minimum guaranteed upward speed after tap-release — ensures the player always rises. */
  tapReleaseMinUpwardVel: 15,
  /** Minimum swing speed before timing-based launch bursts kick in. */
  slingLaunchSpeedThreshold: 10,
  /** Extra forward velocity granted by a well-timed release. */
  slingLaunchForwardBoost: 8.5,
  /** Extra upward velocity granted by a well-timed release. */
  slingLaunchUpwardBoost: 4.5,
  /** Burst score at or above which the release is treated as a perfect launch. */
  slingPerfectReleaseThreshold: 0.72,
  /** Frames a launch burst can exceed the normal speed cap. */
  slingLaunchBoostFrames: 20,
  /** Temporary speed cap during the launch burst window. */
  slingLaunchMaxSpeed: 50,
  /** Frames after attach during which a tap is ignored (prevents accidental instant release). */
  tapReleaseAttachLockout: 4,
  /** How far below the player's spawn altitude they must fall before being soft-respawned. */
  slingFallCatchPx: 1400,
  /** Frames the player is immune after a hazard knockback (avoids double-hits). */
  slingHazardInvuln: 36,
  // ---- Legacy slingshot drag-aim constants (kept for compile compat; no longer driving gameplay) ----
  slingMaxDragPx: 180,
  slingMaxImpulse: 36,
  slingMinImpulse: 11,
  slingDeadZonePx: 14,
  slingHangOffset: 14,
} as const);
