import { describe, expect, it } from 'vitest';
import { World } from '../src/game/World';

describe('World opening pacing', () => {
  it('keeps the opening climb free of hard hazards while seeding rewards', () => {
    const world = new World({
      seed: 1,
      worldWidth: 1200,
      startY: 0,
      spawnGapMin: 140,
      spawnGapMax: 240,
      finishY: null,
    });

    world.generateUpTo(-2600);

    const opening = world.obstacles.filter((o) => o.y <= -150 && o.y >= -2600);
    expect(opening.some((o) => o.kind === 'energy')).toBe(true);
    expect(opening.filter((o) => o.kind === 'spark').length).toBeGreaterThan(3);
    expect(
      opening.some((o) => o.kind === 'spike' || o.kind === 'timed' || o.kind === 'drone'),
    ).toBe(false);
  });
});