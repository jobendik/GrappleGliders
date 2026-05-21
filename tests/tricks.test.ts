import { describe, expect, it } from 'vitest';
import { TrickSystem, type TrickEvent, type TrickUpdateState } from '../src/systems/TrickSystem';
import { Player } from '../src/game/Player';

const stepFrame = (
  trick: TrickSystem,
  player: Player,
  framesSinceStart: number,
  comboMultiplier = 1,
  killY = 100000,
): TrickEvent[] => {
  const events: TrickEvent[] = [];
  trick.on((e) => events.push(e));
  const state: TrickUpdateState = { player, killY, comboMultiplier, framesSinceStart };
  trick.update(state);
  return events;
};

const makePlayer = (): Player => new Player(0, 0);

describe('TrickSystem', () => {
  it('emits a Drop when the player falls 800+ px between hook release and re-attach', () => {
    const trick = new TrickSystem();
    const player = makePlayer();

    // Step 1: hook idle, no event.
    let events = stepFrame(trick, player, 0);
    expect(events).toEqual([]);

    // Step 2: hook attached at the top of the swing.
    player.hook.state = 'attached';
    player.hook.position.set(0, -100);
    player.hook.ropeLength = 80;
    events = stepFrame(trick, player, 1);
    expect(events).toEqual([]);

    // Step 3: release the hook — start of free-fall.
    player.hook.state = 'idle';
    events = stepFrame(trick, player, 2);
    // Release alone shouldn't emit Drop (no fall yet).
    expect(events.find((e) => e.id === 'drop')).toBeUndefined();

    // Step 4: player falls 900 px without grappling.
    player.pos.y += 900;
    events = stepFrame(trick, player, 30);
    expect(events.find((e) => e.id === 'drop')).toBeUndefined();

    // Step 5: re-attach hook — Drop should now fire.
    player.hook.state = 'attached';
    player.hook.position.set(0, player.pos.y - 50);
    player.hook.ropeLength = 50;
    events = stepFrame(trick, player, 31);
    expect(events.find((e) => e.id === 'drop')).toBeDefined();
  });

  it('does not emit Drop if the fall is too small', () => {
    const trick = new TrickSystem();
    const player = makePlayer();
    // Brief attach
    player.hook.state = 'attached';
    player.hook.position.set(0, -100);
    player.hook.ropeLength = 80;
    stepFrame(trick, player, 1);
    // Release
    player.hook.state = 'idle';
    stepFrame(trick, player, 2);
    // Small fall (300 px)
    player.pos.y += 300;
    stepFrame(trick, player, 20);
    // Re-attach
    player.hook.state = 'attached';
    player.hook.position.set(0, player.pos.y - 50);
    player.hook.ropeLength = 50;
    const events = stepFrame(trick, player, 21);
    expect(events.find((e) => e.id === 'drop')).toBeUndefined();
  });

  it('emits a Pendulum when the swing arc exceeds 180°', () => {
    const trick = new TrickSystem();
    const player = makePlayer();
    // Attach at right side of the anchor (anchor at (50,-50), player at origin)
    player.hook.state = 'attached';
    player.hook.position.set(50, -50);
    player.hook.ropeLength = 70;
    // Initial frame establishes lastAnchorAngle
    stepFrame(trick, player, 0);
    // Move the player around the anchor to accumulate ~200° of arc.
    // 8 incremental angle steps of 25° each = 200°.
    const r = 70;
    for (let step = 1; step <= 8; step++) {
      const angle = (Math.PI / 4) + (step * (Math.PI / 7.2)); // ~25° increments
      // Update player position so anchor-relative angle changes by ~25°.
      player.pos.x = player.hook.position.x - Math.cos(angle) * r;
      player.pos.y = player.hook.position.y - Math.sin(angle) * r;
      stepFrame(trick, player, step);
    }
    // Now release; Pendulum should fire because arc > π.
    player.hook.state = 'idle';
    const events = stepFrame(trick, player, 20);
    expect(events.find((e) => e.id === 'pendulum')).toBeDefined();
  });

  it('emits a Whip when three hook releases happen in 2s with rising velocity', () => {
    const trick = new TrickSystem();
    const player = makePlayer();
    // Three quick attach/release cycles, each release faster than the last.
    const speeds = [10, 18, 28];
    for (let i = 0; i < 3; i++) {
      // attach
      player.hook.state = 'attached';
      player.hook.position.set(0, -50);
      player.hook.ropeLength = 50;
      stepFrame(trick, player, i * 20);
      // release with rising velocity
      player.vel.set(speeds[i]!, 0);
      player.hook.state = 'idle';
      const events = stepFrame(trick, player, i * 20 + 1);
      if (i === 2) {
        expect(events.find((e) => e.id === 'whip')).toBeDefined();
      } else {
        expect(events.find((e) => e.id === 'whip')).toBeUndefined();
      }
    }
  });

  it('does not emit Whip when the release velocity is not strictly ascending', () => {
    const trick = new TrickSystem();
    const player = makePlayer();
    const speeds = [20, 30, 15];
    for (let i = 0; i < 3; i++) {
      player.hook.state = 'attached';
      player.hook.position.set(0, -50);
      stepFrame(trick, player, i * 10);
      player.vel.set(speeds[i]!, 0);
      player.hook.state = 'idle';
      const events = stepFrame(trick, player, i * 10 + 1);
      expect(events.find((e) => e.id === 'whip')).toBeUndefined();
    }
  });

  it('emits a Threading after three airborne near-misses', () => {
    const trick = new TrickSystem();
    const player = makePlayer();
    const events: TrickEvent[] = [];
    trick.on((e) => events.push(e));
    const state: TrickUpdateState = {
      player,
      killY: 100000,
      comboMultiplier: 1,
      framesSinceStart: 1,
    };
    trick.onNearMiss(state);
    trick.onNearMiss(state);
    expect(events.find((e) => e.id === 'threading')).toBeUndefined();
    trick.onNearMiss(state);
    expect(events.find((e) => e.id === 'threading')).toBeDefined();
  });

  it('summary aggregates count and score per trick id', () => {
    const trick = new TrickSystem();
    const player = makePlayer();
    // Trigger 3 threading events (via near-miss helper)
    const state: TrickUpdateState = {
      player,
      killY: 100000,
      comboMultiplier: 2,
      framesSinceStart: 1,
    };
    trick.onNearMiss(state);
    trick.onNearMiss(state);
    trick.onNearMiss(state);
    const summary = trick.summary();
    const threadingEntry = summary.tricks.find((t) => t.id === 'threading');
    expect(threadingEntry).toBeDefined();
    expect(threadingEntry!.count).toBe(1);
    // Threading base score is 75 * combo multiplier 2 = 150.
    expect(threadingEntry!.score).toBe(150);
    expect(summary.totalScore).toBe(150);
  });

  it('reset clears all aggregated state', () => {
    const trick = new TrickSystem();
    const player = makePlayer();
    trick.onNearMiss({ player, killY: 100000, comboMultiplier: 1, framesSinceStart: 0 });
    trick.onNearMiss({ player, killY: 100000, comboMultiplier: 1, framesSinceStart: 0 });
    trick.onNearMiss({ player, killY: 100000, comboMultiplier: 1, framesSinceStart: 0 });
    expect(trick.summary().tricks.length).toBe(1);
    trick.reset();
    expect(trick.summary().tricks.length).toBe(0);
  });
});
