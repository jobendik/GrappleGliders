import { describe, expect, it } from 'vitest';
import { PHYSICS } from '../src/game/Physics';
import { Player } from '../src/game/Player';
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

const makePeg = (centerX: number, centerY: number, size = 30): Obstacle => ({
  id: 1,
  x: centerX - size / 2,
  y: centerY - size / 2,
  width: size,
  height: size,
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
  lastX: centerX - size / 2,
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
  tapJustPressed: false,
};

const attachPlayerToPeg = (player: Player, peg: Obstacle): void => {
  player.useSling = true;
  player.hook.state = 'attached';
  player.hook.attached = peg;
  player.hook.position.set(0, -120);
  player.hook.ropeLength = 70;
  player.pos.set(0, -50);
  player.prev.copy(player.pos);
  player.vel.set(0, 0);
};

describe('Easy Mode sling assist', () => {
  it('auto-pumps an idle pendulum so swings build without steer input', () => {
    const world = buildEmptyWorld();
    const peg = makePeg(0, -120);
    world.obstacles.push(peg);

    const assisted = new Player(0, -50);
    assisted.easyModeAssist = true;
    attachPlayerToPeg(assisted, peg);
    assisted.update(1, idleInput, world, 10000);

    const classic = new Player(0, -50);
    classic.easyModeAssist = false;
    attachPlayerToPeg(classic, peg);
    classic.update(1, idleInput, world, 10000);

    expect(Math.abs(assisted.vel.x)).toBeGreaterThan(0.05);
    expect(Math.abs(classic.vel.x)).toBeLessThan(0.01);
  });

  it('widens peg snap range in assisted mode', () => {
    const world = buildEmptyWorld();
    const peg = makePeg(109, 0, 30);
    world.obstacles.push(peg);

    const classic = new Player(0, 0);
    classic.useSling = true;
    classic.slingAttachRange = PHYSICS.slingAttachRange;
    classic.update(1, idleInput, world, 10000);

    const assisted = new Player(0, 0);
    assisted.useSling = true;
    assisted.easyModeAssist = true;
    assisted.slingAttachRange = PHYSICS.slingAttachRange + 18;
    assisted.update(1, idleInput, world, 10000);

    expect(classic.hook.state).toBe('idle');
    expect(assisted.hook.state).toBe('attached');
  });

  it('rewards a fast bottom-of-arc release with a launch burst window', () => {
    const world = buildEmptyWorld();
    const peg = makePeg(0, -120);
    world.obstacles.push(peg);

    const player = new Player(0, -50);
    attachPlayerToPeg(player, peg);
    player.vel.set(18, 0);

    player.update(
      1,
      {
        ...idleInput,
        tapJustPressed: true,
      },
      world,
      10000,
    );

    expect(player.hook.state).toBe('idle');
    expect(player.lastReleaseBurst).toBeGreaterThan(0.45);
    expect(player.launchBoostFrames).toBeGreaterThan(0);
    expect(player.vel.x).toBeGreaterThan(18);
    expect(player.vel.y).toBeLessThan(-PHYSICS.tapReleaseMinUpwardVel);
  });

  it('lets sling players dash upward while flying', () => {
    const world = buildEmptyWorld();
    const player = new Player(0, 0);
    player.useSling = true;
    player.vel.set(0, 3);

    player.update(1, { ...idleInput, dashRequested: true }, world, 10000);

    expect(player.dashCharges).toBe(PHYSICS.maxDashCharges - 1);
    expect(player.dashFlashTimer).toBeGreaterThan(0);
    expect(player.vel.y).toBeLessThan(-8);
  });

  it('recharges sling dash charges while attached to a peg', () => {
    const world = buildEmptyWorld();
    const peg = makePeg(0, -120);
    world.obstacles.push(peg);

    const player = new Player(0, -50);
    attachPlayerToPeg(player, peg);
    player.dashCharges = 0;
    player.dashRecharge = 0;

    for (let i = 0; i < PHYSICS.dashCooldownFrames + 1; i++) {
      player.update(1, idleInput, world, 10000);
    }

    expect(player.dashCharges).toBe(1);
  });
});
