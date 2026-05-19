import { describe, expect, it } from 'vitest';
import {
  PHYSICS,
  Vec2,
  circleRect,
  integrateVelocity,
  rectIntersects,
  springTension,
} from '../src/game/Physics';
import { GrapplingHook } from '../src/game/GrapplingHook';
import type { Obstacle } from '../src/game/World';

const makeObstacle = (overrides: Partial<Obstacle>): Obstacle => ({
  id: 1,
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  kind: 'platform',
  color: '#fff',
  grappleable: true,
  lethal: false,
  bouncy: false,
  unstableTimer: 0,
  unstableTriggered: false,
  amp: 0,
  driftAngle: 0,
  driftSpeed: 0,
  lastX: 0,
  pulse: 0,
  ...overrides,
});

describe('Vec2', () => {
  it('initialises with zero values', () => {
    const v = new Vec2();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('computes length, normalisation, and dot products', () => {
    const v = new Vec2(3, 4);
    expect(v.len()).toBe(5);
    const n = v.clone().norm();
    expect(Math.hypot(n.x, n.y)).toBeCloseTo(1);
    expect(Vec2.dot(new Vec2(1, 0), new Vec2(0, 1))).toBe(0);
    expect(Vec2.dist(new Vec2(0, 0), new Vec2(3, 4))).toBe(5);
  });
});

describe('collision helpers', () => {
  it('detects circle-vs-rect intersection', () => {
    const rect = { x: 0, y: 0, width: 50, height: 10 };
    expect(circleRect(25, 5, 5, rect)).toBe(true);
    expect(circleRect(100, 100, 5, rect)).toBe(false);
    expect(circleRect(52, 5, 5, rect)).toBe(true); // edge proximity
  });

  it('detects rect-vs-rect intersection', () => {
    expect(rectIntersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectIntersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 30, y: 30, width: 10, height: 10 })).toBe(false);
  });
});

describe('spring tension', () => {
  it('returns zero when distance is within rest length', () => {
    expect(springTension(50, 100, 0.05, 1)).toBe(0);
  });

  it('scales with stretch, force constant, and dt', () => {
    const t1 = springTension(150, 100, 0.05, 1);
    const t2 = springTension(150, 100, 0.05, 2);
    expect(t1).toBeCloseTo(2.5);
    expect(t2).toBeCloseTo(5);
  });
});

describe('integrateVelocity', () => {
  it('applies acceleration then drag', () => {
    const result = integrateVelocity(0, 10, 0.5, 1);
    expect(result).toBe(5);
  });
});

describe('GrapplingHook', () => {
  it('starts idle and can shoot', () => {
    const hook = new GrapplingHook();
    expect(hook.state).toBe('idle');
    const result = hook.shoot(new Vec2(0, 0), new Vec2(0, -100));
    expect(result.fired).toBe(true);
    expect(hook.state).toBe('shooting');
    expect(hook.velocity.y).toBeLessThan(0);
  });

  it('attaches to a grappleable obstacle in range and sets rope length', () => {
    const hook = new GrapplingHook();
    const obs = makeObstacle({ x: -50, y: -150, width: 100, height: 20 });
    hook.shoot(new Vec2(0, 0), new Vec2(0, -200));
    // Step until it reaches the obstacle.
    let connectEvent = null;
    for (let i = 0; i < 200 && !connectEvent; i++) {
      connectEvent = hook.step(1, new Vec2(0, 0), [obs]);
    }
    expect(connectEvent).not.toBeNull();
    expect(hook.state).toBe('attached');
    expect(hook.attached).toBe(obs);
    expect(hook.ropeLength).toBeGreaterThanOrEqual(PHYSICS.ropeMinLength);
    expect(hook.ropeLength).toBeLessThanOrEqual(PHYSICS.ropeMaxLength);
  });

  it('detects perfect anchor within 10px of obstacle center', () => {
    const hook = new GrapplingHook();
    const obs = makeObstacle({ x: -5, y: -160, width: 10, height: 10 });
    hook.shoot(new Vec2(0, 0), new Vec2(0, -200));
    let ev = null;
    for (let i = 0; i < 200 && !ev; i++) {
      ev = hook.step(1, new Vec2(0, 0), [obs]);
    }
    expect(ev?.perfectAnchor).toBe(true);
  });

  it('breaks when exceeding max range', () => {
    const hook = new GrapplingHook();
    hook.shoot(new Vec2(0, 0), new Vec2(0, -10000));
    for (let i = 0; i < 200; i++) hook.step(2, new Vec2(0, 0), []);
    expect(hook.state).toBe('idle');
  });

  it('applies tension when player is past rope length', () => {
    const hook = new GrapplingHook();
    const obs = makeObstacle({ x: -10, y: -100, width: 20, height: 10 });
    hook.shoot(new Vec2(0, 0), new Vec2(0, -200));
    for (let i = 0; i < 100; i++) hook.step(1, new Vec2(0, 0), [obs]);
    expect(hook.state).toBe('attached');
    const playerVel = new Vec2(20, 0);
    const before = playerVel.clone();
    hook.applyTension(new Vec2(hook.ropeLength * 2, 0), playerVel, 1);
    expect(playerVel.x).not.toBe(before.x);
  });

  it('ignores spike obstacles', () => {
    const hook = new GrapplingHook();
    const spike = makeObstacle({ x: -50, y: -50, width: 100, height: 20, kind: 'spike', grappleable: false, lethal: true });
    hook.shoot(new Vec2(0, 0), new Vec2(0, -100));
    for (let i = 0; i < 200; i++) hook.step(1, new Vec2(0, 0), [spike]);
    expect(hook.state).toBe('idle');
  });

  it('reels rope length within bounds', () => {
    const hook = new GrapplingHook();
    const obs = makeObstacle({ x: -10, y: -100, width: 20, height: 10 });
    hook.shoot(new Vec2(0, 0), new Vec2(0, -100));
    for (let i = 0; i < 100; i++) hook.step(1, new Vec2(0, 0), [obs]);
    const initial = hook.ropeLength;
    for (let i = 0; i < 100; i++) hook.reel(-1, 1);
    expect(hook.ropeLength).toBeLessThan(initial);
    expect(hook.ropeLength).toBeGreaterThanOrEqual(PHYSICS.ropeMinLength);
    for (let i = 0; i < 10_000; i++) hook.reel(1, 1);
    expect(hook.ropeLength).toBeLessThanOrEqual(PHYSICS.ropeMaxLength);
  });
});
