import { describe, expect, it } from 'vitest';
import { Player } from '../src/game/Player';
import { PHYSICS, Vec2 } from '../src/game/Physics';
import { World, type Obstacle } from '../src/game/World';

const buildEmptyWorld = (): World => {
  const world = new World({
    seed: 1,
    worldWidth: 1000,
    startY: 0,
    spawnGapMin: 200,
    spawnGapMax: 240,
    finishY: null,
  });
  world.obstacles.length = 0;
  return world;
};

const makePlatform = (x: number, y: number, w = 200, h = 20): Obstacle => ({
  id: 1,
  x: x - w / 2,
  y,
  width: w,
  height: h,
  kind: 'platform',
  color: '#00f3ff',
  grappleable: true,
  lethal: false,
  bouncy: false,
  pickup: false,
  collected: false,
  unstableTimer: 0,
  unstableTriggered: false,
  amp: 0,
  driftAngle: 0,
  driftSpeed: 0,
  lastX: x - w / 2,
  pulse: 0,
  variant: 0,
  seedPhase: 0,
});

const idleInput = {
  moveX: 0,
  reel: 0 as -1 | 0 | 1,
  pointerDown: false,
  dashRequested: false,
  hookTarget: null,
  releaseHook: false,
};

describe('Player dash recharge', () => {
  it('starts with max dash charges', () => {
    const p = new Player(0, 0);
    expect(p.dashCharges).toBe(PHYSICS.maxDashCharges);
  });

  it('does not refill dash charges while the hook is idle (no exploit)', () => {
    const world = buildEmptyWorld();
    const p = new Player(0, 0);
    // Burn a dash.
    p.update(1, { ...idleInput, dashRequested: true, hookTarget: new Vec2(0, -100) }, world, 10000);
    expect(p.dashCharges).toBe(PHYSICS.maxDashCharges - 1);
    // Let dashCooldownFrames * 3 elapse with the hook idle. Charges must NOT refill.
    for (let i = 0; i < PHYSICS.dashCooldownFrames * 3; i++) {
      p.update(1, idleInput, world, 10000);
    }
    expect(p.dashCharges).toBe(PHYSICS.maxDashCharges - 1);
  });

  it('refills dash charges while the hook is attached', () => {
    const world = buildEmptyWorld();
    world.obstacles.push(makePlatform(0, -200));
    const p = new Player(0, 0);
    // Burn both dashes.
    p.update(1, { ...idleInput, dashRequested: true, hookTarget: new Vec2(0, -100) }, world, 10000);
    p.update(1, { ...idleInput, dashRequested: true, hookTarget: new Vec2(0, -100) }, world, 10000);
    expect(p.dashCharges).toBe(0);
    // Fire and let the hook attach.
    p.update(1, { ...idleInput, hookTarget: new Vec2(0, -200) }, world, 10000);
    for (let i = 0; i < 30 && p.hook.state !== 'attached'; i++) {
      p.update(1, idleInput, world, 10000);
    }
    expect(p.hook.state).toBe('attached');
    // Tick while attached; charges should recover.
    for (let i = 0; i < PHYSICS.dashCooldownFrames * 2 + 10; i++) {
      p.update(1, idleInput, world, 10000);
    }
    expect(p.dashCharges).toBeGreaterThan(0);
  });
});
