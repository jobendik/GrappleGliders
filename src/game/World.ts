import { SeededRandom } from '../utils/seededRandom';
import { clamp } from '../utils/math';
import type { Rect } from './Physics';

export type ObstacleKind =
  | 'platform'
  | 'energy'
  | 'unstable'
  | 'bouncy'
  | 'spike'
  | 'drone'
  | 'spark'
  | 'shield-pickup'
  | 'magnet-pickup'
  | 'slow-pickup';

export type PickupKind = 'spark' | 'shield-pickup' | 'magnet-pickup' | 'slow-pickup';

export interface Obstacle extends Rect {
  id: number;
  kind: ObstacleKind;
  color: string;
  grappleable: boolean;
  lethal: boolean;
  bouncy: boolean;
  unstableTimer: number;
  unstableTriggered: boolean;
  amp: number;
  driftAngle: number;
  driftSpeed: number;
  lastX: number;
  pulse: number;
  /** True for pickups: they're consumed on touch and never collide solidly. */
  pickup: boolean;
  /** True once collected; cleared from world next update. */
  collected: boolean;
  /**
   * Visual style index 0..2 — used by the renderer to pick between platform
   * variants (classic / circuit / hover). Gameplay-irrelevant. Default 0.
   */
  variant: number;
  /** Deterministic phase offset for per-obstacle animation (0..2π). */
  seedPhase: number;
}

export const OBSTACLE_COLORS: Record<ObstacleKind, string> = {
  // Platforms are deep violet so the cyan default ship pops against them.
  // The renderer adds cyan edge highlights from the theme accent.
  platform: '#5b35e6',
  energy: '#a45cff',
  unstable: '#ff9d2e',
  bouncy: '#00ff8a',
  spike: '#ff255e',
  drone: '#ff2bff',
  spark: '#ffd400',
  'shield-pickup': '#00ff8a',
  'magnet-pickup': '#a45cff',
  'slow-pickup': '#a4f0ff',
};

export const isPickup = (kind: ObstacleKind): kind is PickupKind =>
  kind === 'spark' ||
  kind === 'shield-pickup' ||
  kind === 'magnet-pickup' ||
  kind === 'slow-pickup';

export interface WorldConfig {
  seed: number;
  worldWidth: number;
  startY: number;
  spawnGapMin: number;
  spawnGapMax: number;
  finishY: number | null;
  /** Curated layout instead of procedural generation (used by Time Attack). */
  staticLayout?: Obstacle[] | undefined;
  /**
   * When true, the opening section is hand-tuned to be forgiving:
   *   - Wider initial platforms, centered directly above the spawn point
   *   - Spikes and drones suppressed in the first ~10 procedural groups
   *
   * Set to `true` for the player's first-ever run so the first 20–30s
   * teaches the grapple mechanic without ambushing them with hazards.
   * Gameplay returns to the normal curve once the player has climbed
   * past the safe intro band.
   */
  easyStart?: boolean;
}

let nextObstacleId = 1;

const createObstacle = (partial: Partial<Obstacle> & Pick<Obstacle, 'x' | 'y' | 'width' | 'height' | 'kind'>): Obstacle => {
  const kind = partial.kind;
  const pickup = isPickup(kind);
  // Cheap pseudo-random variant + phase from position so the layout is
  // deterministic per seed but each obstacle still looks unique.
  const hash = Math.floor(Math.abs(partial.x * 7.13 + partial.y * 3.71 + nextObstacleId * 0.91));
  return {
    id: nextObstacleId++,
    color: OBSTACLE_COLORS[kind],
    grappleable: !pickup && kind !== 'spike',
    lethal: kind === 'spike',
    bouncy: kind === 'bouncy',
    pickup,
    collected: false,
    unstableTimer: 0,
    unstableTriggered: false,
    amp: 0,
    driftAngle: 0,
    driftSpeed: 0,
    lastX: partial.x,
    pulse: 0,
    variant: hash % 3,
    seedPhase: (hash % 628) / 100,
    ...partial,
  };
};

export class World {
  obstacles: Obstacle[] = [];
  rng: SeededRandom;
  highestSpawnY: number;
  config: WorldConfig;
  killY: number;
  pathX = 0;
  /**
   * Count of procedural groups spawned so far. The first few groups are
   * gated to "safe content only" when `easyStart` is enabled, then the
   * world transitions to normal difficulty.
   */
  private groupsSpawned = 0;

  constructor(config: WorldConfig) {
    this.config = config;
    this.rng = new SeededRandom(config.seed);
    this.highestSpawnY = config.startY;
    this.killY = config.startY + 600;
    if (config.staticLayout) {
      this.obstacles = config.staticLayout.map((o) => ({ ...o }));
      this.highestSpawnY = this.obstacles.reduce(
        (min, o) => Math.min(min, o.y),
        config.startY,
      );
    } else {
      this.seedInitial();
    }
  }

  /** Set the rising hazard line (lava). */
  setKillY(y: number): void {
    this.killY = y;
  }

  private seedInitial(): void {
    // First few platforms are guaranteed safe. On easy-start (first run)
    // they are wider and centered directly above the spawn point so a
    // brand-new player can hit *any* tap upward and connect. On normal
    // runs we keep a small horizontal wiggle for variety.
    const easy = this.config.easyStart === true;
    const count = easy ? 7 : 6;
    const width = easy ? 260 : 200;
    const wiggle = easy ? 0 : 160;
    const gap = easy ? 160 : 180;
    for (let i = 0; i < count; i++) {
      const y = this.config.startY - 140 - i * gap;
      const x =
        -width / 2 + (wiggle === 0 ? 0 : (this.rng.next() - 0.5) * wiggle);
      this.obstacles.push(
        createObstacle({
          x,
          y,
          width,
          height: 22,
          kind: 'platform',
        }),
      );
      this.highestSpawnY = y;
    }
  }

  /** Generate any obstacles needed above the camera. Called every frame. */
  generateUpTo(visibleTopY: number): void {
    if (this.config.staticLayout) return;
    const lookAhead = visibleTopY - 600;
    while (this.highestSpawnY > lookAhead) {
      const gap =
        this.config.spawnGapMin +
        this.rng.next() * (this.config.spawnGapMax - this.config.spawnGapMin);
      this.highestSpawnY -= gap;
      this.spawnGroup(this.highestSpawnY);
    }
  }

  private spawnGroup(y: number): void {
    this.groupsSpawned += 1;
    // First ~25 procedural groups of an easy-start run are restricted to
    // safe content — platforms, bouncy pads, energy anchors, sparks, and
    // basic pickups. Spikes, unstable platforms, and patrolling drones
    // appear only after the player has had time to learn the grapple.
    // 25 groups covers the full tutorial flow (player reaches ~120m) plus
    // a generous post-tutorial buffer.
    const safeBand = this.config.easyStart === true && this.groupsSpawned <= 25;
    const roll = this.rng.next();
    const half = this.config.worldWidth / 2;
    // Path snake — bias new platforms toward a wandering centerline.
    // Slightly tighter wandering during the safe band so platforms stay
    // close to the player's expected vertical channel.
    const snake = safeBand ? 140 : 220;
    this.pathX += (this.rng.next() - 0.5) * snake;
    this.pathX = clamp(this.pathX, -half + 80, half - 80);

    if (roll < 0.62) {
      // Standard platform row, 1-2 platforms with a gap.
      const count = this.rng.next() < 0.4 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const width = 100 + this.rng.next() * 120;
        const x = this.pathX + (count === 1 ? -width / 2 : (i === 0 ? -180 : 60));
        // Suppress unstable platforms during the safe band — they crumble
        // out from under a new player and feel like an unfair death.
        const kind: ObstacleKind =
          !safeBand && this.rng.next() < 0.18 ? 'unstable' : 'platform';
        this.obstacles.push(
          createObstacle({
            x: clamp(x, -half + 20, half - width - 20),
            y,
            width,
            height: 18,
            kind,
          }),
        );
      }
    } else if (roll < 0.78) {
      // Energy node — best anchor.
      const size = 30 + this.rng.next() * 14;
      this.obstacles.push(
        createObstacle({
          x: this.pathX - size / 2,
          y,
          width: size,
          height: size,
          kind: 'energy',
        }),
      );
    } else if (roll < 0.88) {
      // Bouncy panel.
      const width = 90 + this.rng.next() * 60;
      this.obstacles.push(
        createObstacle({
          x: this.pathX - width / 2,
          y,
          width,
          height: 14,
          kind: 'bouncy',
        }),
      );
    } else if (roll < 0.95) {
      // Spike hazard (no grapple) — replaced with an extra platform during
      // the safe band so first-run players don't see a lethal obstacle
      // before they've learned to grapple.
      if (safeBand) {
        const width = 120 + this.rng.next() * 80;
        this.obstacles.push(
          createObstacle({
            x: clamp(this.pathX - width / 2, -half + 20, half - width - 20),
            y,
            width,
            height: 18,
            kind: 'platform',
          }),
        );
      } else {
        const width = 60 + this.rng.next() * 60;
        const sideRoll = this.rng.next();
        const x = sideRoll < 0.5 ? this.pathX - 260 : this.pathX + 160;
        this.obstacles.push(
          createObstacle({
            x: clamp(x, -half + 20, half - width - 20),
            y,
            width,
            height: 12,
            kind: 'spike',
          }),
        );
      }
    } else {
      // Drifting drone — slow horizontal oscillation. Safe band substitutes
      // a static energy node so the player still gets a worthy anchor.
      if (safeBand) {
        const size = 32 + this.rng.next() * 12;
        this.obstacles.push(
          createObstacle({
            x: this.pathX - size / 2,
            y,
            width: size,
            height: size,
            kind: 'energy',
          }),
        );
      } else {
        const width = 36;
        const height = 24;
        const obs = createObstacle({
          x: this.pathX - width / 2,
          y,
          width,
          height,
          kind: 'drone',
        });
        obs.amp = 120 + this.rng.next() * 80;
        obs.driftAngle = this.rng.next() * Math.PI * 2;
        obs.driftSpeed = 0.4 + this.rng.next() * 0.6;
        this.obstacles.push(obs);
      }
    }

    // Mid-air sparks scattered between platforms (high frequency, immediate reward loop).
    if (this.rng.next() < 0.55) {
      const sparkCount = 1 + (this.rng.next() < 0.3 ? 1 : 0);
      for (let i = 0; i < sparkCount; i++) {
        const sx = this.pathX + (this.rng.next() - 0.5) * 320;
        const sy = y - 40 - this.rng.next() * 80;
        this.obstacles.push(
          createObstacle({
            x: clamp(sx, -half + 14, half - 14) - 8,
            y: sy,
            width: 16,
            height: 16,
            kind: 'spark',
          }),
        );
      }
    }
    // Rarer powerup drops — pickable circles that grant a temporary effect.
    if (this.rng.next() < 0.06) {
      const r = this.rng.next();
      const kind: PickupKind = r < 0.4 ? 'shield-pickup' : r < 0.75 ? 'slow-pickup' : 'magnet-pickup';
      this.obstacles.push(
        createObstacle({
          x: this.pathX - 14,
          y: y - 90,
          width: 28,
          height: 28,
          kind,
        }),
      );
    }
  }

  /** Advance time-dependent obstacle behavior: drone drift, unstable countdown. */
  update(dt: number): void {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!;
      o.lastX = o.x;
      o.pulse = (o.pulse + dt * 0.04) % (Math.PI * 2);
      if (o.collected) {
        this.obstacles.splice(i, 1);
        continue;
      }
      if (o.kind === 'drone' && o.amp) {
        o.driftAngle += o.driftSpeed * dt * 0.02;
        const baseX = o.x - Math.sin(o.driftAngle - o.driftSpeed * dt * 0.02) * o.amp;
        o.x = baseX + Math.sin(o.driftAngle) * o.amp;
      }
      if (o.unstableTriggered) {
        o.unstableTimer += dt;
        if (o.unstableTimer > 24) {
          this.obstacles.splice(i, 1);
          continue;
        }
      }
      // Cull anything well below the kill line.
      if (o.y > this.killY + 300) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  cullBelow(y: number): void {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      if (this.obstacles[i]!.y > y) this.obstacles.splice(i, 1);
    }
  }

  triggerUnstable(obs: Obstacle): void {
    if (obs.kind !== 'unstable' || obs.unstableTriggered) return;
    obs.unstableTriggered = true;
  }
}
