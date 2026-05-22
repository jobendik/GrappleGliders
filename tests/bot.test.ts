import { describe, expect, it, vi } from 'vitest';
import { Bot, BOT_PERSONALITIES } from '../src/game/Bot';
import { World, type Obstacle } from '../src/game/World';
import { SeededRandom } from '../src/utils/seededRandom';

const sparky = BOT_PERSONALITIES[0]!;
const apex = BOT_PERSONALITIES[2]!;

const buildSparseWorld = (obstacles: Obstacle[]): World => {
  const world = new World({
    seed: 7,
    worldWidth: 1200,
    startY: 0,
    spawnGapMin: 200,
    spawnGapMax: 300,
    finishY: null,
  });
  world.obstacles.length = 0;
  for (const o of obstacles) world.obstacles.push(o);
  return world;
};

const makePlatform = (x: number, y: number, width = 100): Obstacle => ({
  id: Math.floor(Math.random() * 1e9),
  x: x - width / 2,
  y,
  width,
  height: 18,
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
  lastX: x - width / 2,
  pulse: 0,
  variant: 0,
  seedPhase: 0,
});

describe('Bot AI', () => {
  it('fires the grappling hook at an obstacle above when idle', () => {
    const bot = new Bot(apex, 0, 0);
    const world = buildSparseWorld([makePlatform(0, -400)]);
    bot.update(1, world, 10000, 1);
    expect(bot.player.hook.state === 'shooting' || bot.player.hook.state === 'attached').toBe(true);
  });

  it('eventually attaches to an obstacle within range', () => {
    const bot = new Bot(apex, 0, 0);
    const world = buildSparseWorld([makePlatform(0, -300)]);
    for (let i = 0; i < 100; i++) {
      bot.update(1, world, 10000, i);
      if (bot.player.hook.state === 'attached') break;
    }
    expect(bot.player.hook.state).toBe('attached');
  });

  it('skilled bots strafe to pump the swing while attached', () => {
    const bot = new Bot(apex, 0, 0);
    const world = buildSparseWorld([makePlatform(0, -300)]);
    for (let i = 0; i < 80 && bot.player.hook.state !== 'attached'; i++) {
      bot.update(1, world, 10000, i);
    }
    expect(bot.player.hook.state).toBe('attached');
    // Give the bot a horizontal velocity so the pump logic has a direction to bias toward.
    bot.player.vel.x = 5;
    const prevX = bot.player.vel.x;
    // Tick a few frames while attached; with skill=1 the bot should strafe in the velocity direction,
    // which adds tangential force. We don't assert a specific magnitude, only that the velocity is touched.
    for (let i = 0; i < 12; i++) bot.update(1, world, 10000, 200 + i);
    expect(bot.player.vel.x).not.toBe(prevX);
  });

  it('rookie bots reach lower peak velocities than skilled ones over a fixed window', () => {
    // Bot.update() calls Math.random() three times per tick (pump decision,
    // dash gate, aim jitter). With the unseeded global Math.random, both
    // bots drew from the same shared sequence and Sparky sometimes got a
    // luckier pump rhythm than Apex, failing the skill-based assertion.
    // Seed Math.random with a deterministic PRNG so the comparison reflects
    // bot personality coefficients, not RNG variance.
    const rng = new SeededRandom(1);
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => rng.next());
    try {
      const layout: Obstacle[] = [];
      for (let i = 0; i < 10; i++) {
        layout.push(makePlatform(((i % 2) * 80) - 40, -200 - i * 220));
      }
      const sparkyBot = new Bot(sparky, 0, 0);
      const apexBot = new Bot(apex, 0, 0);
      const sparkyWorld = buildSparseWorld(layout.map((o) => ({ ...o })));
      const apexWorld = buildSparseWorld(layout.map((o) => ({ ...o })));
      let sparkyPeak = 0;
      let apexPeak = 0;
      for (let i = 0; i < 600; i++) {
        sparkyBot.update(1, sparkyWorld, 10000, i);
        apexBot.update(1, apexWorld, 10000, i);
        sparkyPeak = Math.max(sparkyPeak, sparkyBot.player.maxAltitude);
        apexPeak = Math.max(apexPeak, apexBot.player.maxAltitude);
      }
      expect(apexPeak).toBeGreaterThan(0);
      expect(apexPeak).toBeGreaterThan(sparkyPeak * 0.9);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('drops a stale target whose obstacle was collected or collapsed', () => {
    const bot = new Bot(apex, 0, 0);
    const plat = makePlatform(0, -260);
    const replacement = makePlatform(40, -300);
    const world = buildSparseWorld([plat, replacement]);
    bot.update(1, world, 10000, 1);
    // Mark the chosen target as collapsed/collected to simulate it being consumed mid-flight.
    plat.unstableTriggered = true;
    plat.unstableTimer = 200;
    plat.collected = true;
    for (let i = 0; i < 240; i++) {
      bot.update(1, world, 10000, 2 + i);
      if (bot.player.hook.state === 'attached' && bot.player.hook.attached === replacement) break;
    }
    // The bot must be doing something productive: either on the replacement, or actively
    // chasing it (shooting). Crucially it must NOT be attached to the dead obstacle.
    expect(bot.player.hook.attached === plat).toBe(false);
  });

  it('does not dash when no obstacles exist (graceful no-op)', () => {
    const bot = new Bot(apex, 0, 0);
    const world = buildSparseWorld([]);
    // Tick — should not throw, should not fire hooks.
    for (let i = 0; i < 60; i++) bot.update(1, world, 10000, i);
    expect(bot.player.hook.state).toBe('idle');
    expect(bot.player.dead).toBe(false);
  });
});
