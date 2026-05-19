import { describe, expect, it } from 'vitest';
import { Player } from '../src/game/Player';
import { World, type Obstacle, type PickupKind } from '../src/game/World';

const buildWorldWithPickup = (kind: PickupKind, x: number, y: number): { world: World; pickup: Obstacle } => {
  const world = new World({
    seed: 1,
    worldWidth: 1000,
    startY: 0,
    spawnGapMin: 200,
    spawnGapMax: 240,
    finishY: null,
  });
  // Replace world content with a single pickup for a deterministic test.
  world.obstacles.length = 0;
  const pickup: Obstacle = {
    id: 999,
    x: x - 10,
    y: y - 10,
    width: 20,
    height: 20,
    kind,
    color: '#fff',
    grappleable: false,
    lethal: false,
    bouncy: false,
    pickup: true,
    collected: false,
    unstableTimer: 0,
    unstableTriggered: false,
    amp: 0,
    driftAngle: 0,
    driftSpeed: 0,
    lastX: x - 10,
    pulse: 0,
  };
  world.obstacles.push(pickup);
  return { world, pickup };
};

describe('Player pickup interactions', () => {
  it('fires onPickup and marks the obstacle collected when touching a spark', () => {
    const { world, pickup } = buildWorldWithPickup('spark', 0, 0);
    const player = new Player(0, 0);
    let pickedUp: PickupKind | null = null;
    player.setEvents({
      onPickup: (kind) => {
        pickedUp = kind;
      },
    });
    player.update(
      1,
      { moveX: 0, reel: 0, pointerDown: false, dashRequested: false, hookTarget: null, releaseHook: false },
      world,
      10000,
    );
    expect(pickedUp).toBe('spark');
    expect(pickup.collected).toBe(true);
  });

  it('shield pickup grants a shield charge and the shield absorbs the next lethal hit', () => {
    const { world } = buildWorldWithPickup('shield-pickup', 0, 0);
    const player = new Player(0, 0);
    player.update(
      1,
      { moveX: 0, reel: 0, pointerDown: false, dashRequested: false, hookTarget: null, releaseHook: false },
      world,
      10000,
    );
    expect(player.shield).toBe(1);

    // Drop a spike right on the player and ensure the shield absorbs it.
    const spike: Obstacle = {
      id: 5,
      x: -50,
      y: -10,
      width: 100,
      height: 20,
      kind: 'spike',
      color: '#f00',
      grappleable: false,
      lethal: true,
      bouncy: false,
      pickup: false,
      collected: false,
      unstableTimer: 0,
      unstableTriggered: false,
      amp: 0,
      driftAngle: 0,
      driftSpeed: 0,
      lastX: -50,
      pulse: 0,
    };
    world.obstacles.push(spike);
    player.update(
      1,
      { moveX: 0, reel: 0, pointerDown: false, dashRequested: false, hookTarget: null, releaseHook: false },
      world,
      10000,
    );
    expect(player.shield).toBe(0);
    expect(player.dead).toBe(false);
  });

  it('magnet pickup enables a wider pull-in radius for sparks', () => {
    const { world } = buildWorldWithPickup('magnet-pickup', 0, 0);
    const player = new Player(0, 0);
    player.update(
      1,
      { moveX: 0, reel: 0, pointerDown: false, dashRequested: false, hookTarget: null, releaseHook: false },
      world,
      10000,
    );
    expect(player.magnetFrames).toBeGreaterThan(0);

    // Place a spark 80px away — within magnet radius (140) but outside touch.
    const spark: Obstacle = {
      id: 7,
      x: 80,
      y: -8,
      width: 16,
      height: 16,
      kind: 'spark',
      color: '#ffd400',
      grappleable: false,
      lethal: false,
      bouncy: false,
      pickup: true,
      collected: false,
      unstableTimer: 0,
      unstableTriggered: false,
      amp: 0,
      driftAngle: 0,
      driftSpeed: 0,
      lastX: 80,
      pulse: 0,
    };
    world.obstacles.push(spark);
    let pickedSpark = false;
    player.setEvents({
      onPickup: (kind) => {
        if (kind === 'spark') pickedSpark = true;
      },
    });
    player.update(
      1,
      { moveX: 0, reel: 0, pointerDown: false, dashRequested: false, hookTarget: null, releaseHook: false },
      world,
      10000,
    );
    expect(pickedSpark).toBe(true);
  });

  it('lava kill is absorbed by a shield instead of ending the run', () => {
    const { world } = buildWorldWithPickup('shield-pickup', 0, 0);
    const player = new Player(0, 0);
    player.update(
      1,
      { moveX: 0, reel: 0, pointerDown: false, dashRequested: false, hookTarget: null, releaseHook: false },
      world,
      10000,
    );
    expect(player.shield).toBe(1);
    // Run with a killY just above the player so the next update would normally kill them.
    player.update(
      1,
      { moveX: 0, reel: 0, pointerDown: false, dashRequested: false, hookTarget: null, releaseHook: false },
      world,
      -5,
    );
    expect(player.dead).toBe(false);
    expect(player.shield).toBe(0);
  });
});
