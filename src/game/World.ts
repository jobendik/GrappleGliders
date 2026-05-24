import { SeededRandom } from '../utils/seededRandom';
import { clamp } from '../utils/math';
import type { Rect } from './Physics';

export type ObstacleKind =
  | 'platform'
  | 'energy'
  | 'unstable'
  | 'timed'
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
  timed: '#ffa726',
  bouncy: '#00ff8a',
  spike: '#ff255e',
  drone: '#ff2bff',
  spark: '#ffd400',
  'shield-pickup': '#00ff8a',
  'magnet-pickup': '#a45cff',
  'slow-pickup': '#a4f0ff',
};

/** Cycle length (frames at 60fps) for timed pegs — 2 seconds total. */
export const TIMED_PEG_PERIOD = 120;
/** Fraction of the cycle a timed peg is active (snappable). */
export const TIMED_PEG_ACTIVE_FRAC = 0.55;

/** True when a timed peg's cycle window is currently in its active phase. */
export const isTimedPegActive = (
  obs: Pick<Obstacle, 'seedPhase'>,
  frames: number,
): boolean => {
  const phaseOffset = (obs.seedPhase / (Math.PI * 2)) * TIMED_PEG_PERIOD;
  const cyclePos = ((frames + phaseOffset) % TIMED_PEG_PERIOD + TIMED_PEG_PERIOD) % TIMED_PEG_PERIOD;
  return cyclePos < TIMED_PEG_PERIOD * TIMED_PEG_ACTIVE_FRAC;
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
  /** Internal frame counter — drives the timed-peg active/inactive cycle. */
  private frames = 0;

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
    // Slingshot pegs are small discrete dots, not horizontal bars. The very
    // first peg sits directly above the spawn point so the player drifts
    // upward straight onto it; subsequent pegs zig-zag left/right so the
    // player has to aim their slings, not just hold a single direction.
    const easy = this.config.easyStart === true;
    const count = easy ? 8 : 6;
    const gap = easy ? 150 : 170;
    const size = 30;
    let prevCenterX = 0;
    let prevY = this.config.startY;
    for (let i = 0; i < count; i++) {
      const y = this.config.startY - 150 - i * gap;
      let centerX = 0;
      if (i >= 2) centerX = i % 2 === 0 ? -90 : 90;
      const kind: ObstacleKind = i > 0 && i % 3 === 0 ? 'energy' : 'platform';
      this.obstacles.push(
        createObstacle({
          x: centerX - size / 2,
          y,
          width: size,
          height: size,
          kind,
        }),
      );
      if (i > 0) {
        const sparkCount = easy ? 2 : 1;
        for (let s = 1; s <= sparkCount; s++) {
          const t = s / (sparkCount + 1);
          const sx = prevCenterX + (centerX - prevCenterX) * t;
          const sy = prevY + (y - prevY) * t - 8;
          this.obstacles.push(
            createObstacle({
              x: sx - 8,
              y: sy,
              width: 16,
              height: 16,
              kind: 'spark',
            }),
          );
        }
      }
      prevCenterX = centerX;
      prevY = y;
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

  private spawnMomentumLane(y: number, half: number, earlyGame: boolean): boolean {
    const openingBurst = this.groupsSpawned >= 3 && this.groupsSpawned <= 14;
    const recurringBurst = this.groupsSpawned > 14 && this.groupsSpawned % 7 === 0;
    const chance = openingBurst ? 0.52 : recurringBurst ? 0.26 : 0;
    if (chance === 0 || this.rng.next() >= chance) return false;

    const pegCount = openingBurst ? 3 : 4;
    const direction = this.rng.next() < 0.5 ? -1 : 1;
    const stepX = openingBurst ? 92 + this.rng.next() * 20 : 104 + this.rng.next() * 28;
    const stepY = openingBurst ? 74 + this.rng.next() * 18 : 88 + this.rng.next() * 24;
    const anchorX = clamp(
      this.pathX - direction * stepX * ((pegCount - 1) / 2),
      -half + 150,
      half - 150,
    );

    const pegs: Array<{ x: number; y: number; size: number; kind: ObstacleKind }> = [];
    for (let i = 0; i < pegCount; i++) {
      const kind: ObstacleKind =
        i === pegCount - 1 || (openingBurst && i === 1) ? 'energy' : 'platform';
      const size = kind === 'energy' ? 34 + this.rng.next() * 6 : 27 + this.rng.next() * 5;
      pegs.push({
        x: clamp(anchorX + direction * i * stepX, -half + 34, half - 34),
        y: y - i * stepY,
        size,
        kind,
      });
    }

    for (const peg of pegs) {
      this.obstacles.push(
        createObstacle({
          x: peg.x - peg.size / 2,
          y: peg.y,
          width: peg.size,
          height: peg.size,
          kind: peg.kind,
        }),
      );
    }

    for (let i = 0; i < pegs.length - 1; i++) {
      const from = pegs[i]!;
      const to = pegs[i + 1]!;
      const sparkCount = openingBurst ? 2 : 3;
      for (let s = 1; s <= sparkCount; s++) {
        const t = s / (sparkCount + 1);
        const sx = from.x + (to.x - from.x) * t + (this.rng.next() - 0.5) * 14;
        const sy = from.y + (to.y - from.y) * t - 6 + (this.rng.next() - 0.5) * 12;
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

    if (earlyGame && this.rng.next() < 0.45) {
      const topPeg = pegs[pegs.length - 1]!;
      const kind: PickupKind = this.rng.next() < 0.6 ? 'magnet-pickup' : 'shield-pickup';
      this.obstacles.push(
        createObstacle({
          x: clamp(topPeg.x, -half + 20, half - 20) - 14,
          y: topPeg.y - 70,
          width: 28,
          height: 28,
          kind,
        }),
      );
    }

    return true;
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
    const earlyGame = this.groupsSpawned <= 16;
    const roll = this.rng.next();
    const half = this.config.worldWidth / 2;
    // Path snake — bias new platforms toward a wandering centerline.
    // Slightly tighter wandering during the safe band so platforms stay
    // close to the player's expected vertical channel.
    const snake = safeBand ? 140 : earlyGame ? 170 : 220;
    this.pathX += (this.rng.next() - 0.5) * snake;
    this.pathX = clamp(this.pathX, -half + 80, half - 80);

    if (!safeBand && this.spawnMomentumLane(y, half, earlyGame)) return;

    // Slingshot world: each spawn slot drops a small peg (sometimes a
    // hazard or kicker). Pegs are 24–34 px squares that the renderer draws
    // as glowing circular dots — no wide horizontal bars.
    if (roll < 0.58) {
      // Standard peg row: 1–3 small pegs offset horizontally around pathX.
      const count = safeBand
        ? 1
        : earlyGame
          ? (this.rng.next() < 0.65 ? 2 : 3)
          : (this.rng.next() < 0.5 ? 2 : this.rng.next() < 0.7 ? 1 : 3);
      const spacing = earlyGame ? 120 + this.rng.next() * 55 : 150 + this.rng.next() * 80;
      const baseOffset = -((count - 1) / 2) * spacing;
      for (let i = 0; i < count; i++) {
        const size = 26 + this.rng.next() * 8;
        const x = this.pathX + baseOffset + i * spacing;
        const kind: ObstacleKind =
          !safeBand && this.rng.next() < 0.15 ? 'unstable' : 'platform';
        this.obstacles.push(
          createObstacle({
            x: clamp(x, -half + 30, half - 30) - size / 2,
            y,
            width: size,
            height: size,
            kind,
          }),
        );
      }
    } else if (roll < 0.7) {
      // Energy peg — the prime anchor, larger and brighter.
      const size = 32 + this.rng.next() * 10;
      this.obstacles.push(
        createObstacle({
          x: this.pathX - size / 2,
          y,
          width: size,
          height: size,
          kind: 'energy',
        }),
      );
      // Often paired with a small companion peg off to one side so the
      // player has a choice.
      if (this.rng.next() < (earlyGame ? 0.85 : 0.5)) {
        const compSize = 26;
        const side = this.rng.next() < 0.5 ? -1 : 1;
        const cx = this.pathX + side * (earlyGame ? 110 + this.rng.next() * 60 : 140 + this.rng.next() * 80);
        this.obstacles.push(
          createObstacle({
            x: clamp(cx, -half + 30, half - 30) - compSize / 2,
            y: y - 30 + this.rng.next() * 60,
            width: compSize,
            height: compSize,
            kind: 'platform',
          }),
        );
      }
    } else if (roll < 0.78 && !safeBand && !earlyGame) {
      // Timed peg — active only during the bright half of its cycle.
      const size = 26 + this.rng.next() * 8;
      this.obstacles.push(
        createObstacle({
          x: this.pathX - size / 2,
          y,
          width: size,
          height: size,
          kind: 'timed',
        }),
      );
      // Pair it with a regular peg as a backup line so the player isn't
      // stranded if they mistime the cycle.
      const compSize = 26;
      const side = this.rng.next() < 0.5 ? -1 : 1;
      const cx = this.pathX + side * (150 + this.rng.next() * 70);
      this.obstacles.push(
        createObstacle({
          x: clamp(cx, -half + 30, half - 30) - compSize / 2,
          y: y + 20,
          width: compSize,
          height: compSize,
          kind: 'platform',
        }),
      );
    } else if (roll < 0.86) {
      // Bouncy kicker panel — these stay as horizontal bars; they're
      // surfaces you ricochet off, not slingshot targets.
      const width = safeBand ? 60 + this.rng.next() * 30 : 80 + this.rng.next() * 50;
      this.obstacles.push(
        createObstacle({
          x: this.pathX - width / 2,
          y,
          width,
          height: 14,
          kind: 'bouncy',
        }),
      );
      // Always pair a bouncy panel with a peg above so the kick has a target.
      const pegSize = 28;
      this.obstacles.push(
        createObstacle({
          x: this.pathX - pegSize / 2,
          y: y - 130,
          width: pegSize,
          height: pegSize,
          kind: 'platform',
        }),
      );
    } else if (roll < 0.95) {
      // Spike hazard — placed off to the side of the path so it gates a
      // bad-aim launch instead of being unavoidable.
      if (safeBand || earlyGame) {
        const size = earlyGame && this.rng.next() < 0.4 ? 34 : 28;
        const kind: ObstacleKind = size > 30 ? 'energy' : 'platform';
        this.obstacles.push(
          createObstacle({
            x: this.pathX - size / 2,
            y,
            width: size,
            height: size,
            kind,
          }),
        );
        if (earlyGame && this.rng.next() < 0.55) {
          const wingSize = 26;
          const side = this.rng.next() < 0.5 ? -1 : 1;
          this.obstacles.push(
            createObstacle({
              x: clamp(this.pathX + side * (110 + this.rng.next() * 50), -half + 30, half - 30) - wingSize / 2,
              y: y - 24,
              width: wingSize,
              height: wingSize,
              kind: 'platform',
            }),
          );
        }
      } else {
        const width = 60 + this.rng.next() * 50;
        const sideRoll = this.rng.next();
        const x = sideRoll < 0.5 ? this.pathX - 230 : this.pathX + 130;
        this.obstacles.push(
          createObstacle({
            x: clamp(x, -half + 20, half - width - 20),
            y,
            width,
            height: 12,
            kind: 'spike',
          }),
        );
        // Add a peg in the safe lane so the player still has somewhere to go.
        const pegSize = 28;
        const safeX = sideRoll < 0.5 ? this.pathX + 90 : this.pathX - 90;
        this.obstacles.push(
          createObstacle({
            x: clamp(safeX, -half + 30, half - 30) - pegSize / 2,
            y,
            width: pegSize,
            height: pegSize,
            kind: 'platform',
          }),
        );
      }
    } else {
      // Drifting drone peg — moves horizontally. Safe band substitutes a
      // static peg so the player isn't chasing a moving target while learning.
      if (safeBand || earlyGame) {
        const size = earlyGame && this.rng.next() < 0.55 ? 34 : 30;
        const kind: ObstacleKind = size > 30 ? 'energy' : 'platform';
        this.obstacles.push(
          createObstacle({
            x: this.pathX - size / 2,
            y,
            width: size,
            height: size,
            kind,
          }),
        );
      } else {
        const size = 30;
        const obs = createObstacle({
          x: this.pathX - size / 2,
          y,
          width: size,
          height: size,
          kind: 'drone',
        });
        obs.amp = 100 + this.rng.next() * 80;
        obs.driftAngle = this.rng.next() * Math.PI * 2;
        obs.driftSpeed = 0.4 + this.rng.next() * 0.5;
        this.obstacles.push(obs);
      }
    }

    // Mid-air sparks scattered between platforms (high frequency, immediate reward loop).
    if (this.rng.next() < (earlyGame ? 0.72 : 0.55)) {
      const sparkCount = 1 + (this.rng.next() < (earlyGame ? 0.55 : 0.3) ? 1 : 0);
      for (let i = 0; i < sparkCount; i++) {
        const sx = this.pathX + (this.rng.next() - 0.5) * (earlyGame ? 240 : 320);
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
    if (this.rng.next() < (earlyGame ? 0.1 : 0.06)) {
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
    this.frames += dt;
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
      if (o.kind === 'timed') {
        // Flip grappleable based on the cycle. The renderer keys off this to
        // dim the peg when it's inactive.
        o.grappleable = isTimedPegActive(o, this.frames);
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
