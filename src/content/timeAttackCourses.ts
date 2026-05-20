import type { Obstacle, ObstacleKind } from '../game/World';

export type CourseSpec =
  | { y: number; kind: 'platform' | 'energy' | 'bouncy'; x: number; w?: number; h?: number }
  | { y: number; kind: 'spike'; x: number; w: number }
  | { y: number; kind: 'spark' | 'shield-pickup' | 'slow-pickup' | 'magnet-pickup'; x: number };

export interface TimeAttackCourse {
  id: string;
  name: string;
  /** One-line pitch used on the course-select card. */
  blurb: string;
  /** Theme tint used by the selector and course card. */
  accent: string;
  /** Vertical target altitude in metres. */
  targetAltitude: number;
  /** Medal thresholds (seconds). Lower is better. */
  medals: { gold: number; silver: number; bronze: number };
  /** Course layout in design-space (y in metres, x in pixels). */
  route: CourseSpec[];
}

// ────────────────────────────────────────────────────────────────────────────
// Rookie — gentle 5000m course. Original launch route, preserved as the entry
// course so existing save data still maps cleanly to a recognisable layout.
// ────────────────────────────────────────────────────────────────────────────
const rookieRoute: CourseSpec[] = [
  // Act 1 — gentle ascent (0–1000m).
  { y: 80, kind: 'platform', x: -40, w: 220 },
  { y: 220, kind: 'platform', x: 80, w: 200 },
  { y: 360, kind: 'platform', x: -120, w: 200 },
  { y: 500, kind: 'energy', x: 60 },
  { y: 640, kind: 'platform', x: -180, w: 180 },
  { y: 760, kind: 'platform', x: 100, w: 200 },
  { y: 900, kind: 'energy', x: -40 },
  // Act 2 — pendulum bowls (1000–2500m).
  { y: 1040, kind: 'platform', x: -220, w: 140 },
  { y: 1040, kind: 'platform', x: 120, w: 140 },
  { y: 1180, kind: 'energy', x: 0 },
  { y: 1220, kind: 'spike', x: 160, w: 80 },
  { y: 1340, kind: 'platform', x: -240, w: 160 },
  { y: 1340, kind: 'spike', x: 100, w: 120 },
  { y: 1480, kind: 'energy', x: -60 },
  { y: 1560, kind: 'spark', x: 60 },
  { y: 1620, kind: 'platform', x: 160, w: 160 },
  { y: 1720, kind: 'shield-pickup', x: 0 },
  { y: 1800, kind: 'energy', x: 120 },
  { y: 1880, kind: 'spike', x: -200, w: 110 },
  { y: 1960, kind: 'platform', x: -60, w: 200 },
  { y: 2120, kind: 'energy', x: -200 },
  { y: 2280, kind: 'energy', x: 200 },
  { y: 2440, kind: 'platform', x: 0, w: 200 },
  // Act 3 — S-bend gauntlet (2500–3800m).
  { y: 2580, kind: 'bouncy', x: -240, w: 100 },
  { y: 2640, kind: 'energy', x: 160 },
  { y: 2720, kind: 'spike', x: -120, w: 100 },
  { y: 2780, kind: 'platform', x: 140, w: 180 },
  { y: 2900, kind: 'spark', x: -80 },
  { y: 2960, kind: 'energy', x: -200 },
  { y: 3060, kind: 'bouncy', x: 200, w: 120 },
  { y: 3160, kind: 'energy', x: 80 },
  { y: 3240, kind: 'spike', x: -160, w: 90 },
  { y: 3280, kind: 'platform', x: 140, w: 160 },
  { y: 3400, kind: 'energy', x: -120 },
  { y: 3480, kind: 'slow-pickup', x: 60 },
  { y: 3560, kind: 'energy', x: 220 },
  { y: 3680, kind: 'platform', x: -180, w: 180 },
  { y: 3800, kind: 'energy', x: 60 },
  // Act 4 — final ascent (3800–5000m).
  { y: 3960, kind: 'energy', x: -120 },
  { y: 4080, kind: 'platform', x: 160, w: 140 },
  { y: 4220, kind: 'energy', x: -40 },
  { y: 4360, kind: 'spike', x: 180, w: 110 },
  { y: 4380, kind: 'energy', x: 80 },
  { y: 4520, kind: 'bouncy', x: -180, w: 100 },
  { y: 4680, kind: 'energy', x: 200 },
  { y: 4820, kind: 'energy', x: -100 },
  { y: 4960, kind: 'platform', x: 0, w: 280 },
];

// ────────────────────────────────────────────────────────────────────────────
// The Spire — 4000m. Vertical and tight. Platforms-heavy; punishes long swings
// because anchors sit close together. Bronze is generous, gold demands clean
// dash recharges between platform-to-platform whip-fires.
// ────────────────────────────────────────────────────────────────────────────
const spireRoute: CourseSpec[] = [
  // Ground floor: tight starting cluster.
  { y: 60, kind: 'platform', x: -20, w: 180 },
  { y: 160, kind: 'platform', x: 100, w: 120 },
  { y: 240, kind: 'platform', x: -140, w: 120 },
  { y: 320, kind: 'platform', x: 60, w: 110 },
  { y: 400, kind: 'platform', x: -90, w: 110 },
  { y: 480, kind: 'energy', x: 30 },
  { y: 540, kind: 'spark', x: -50 },
  // Mid: spiral upward — alternate sides aggressively.
  { y: 620, kind: 'platform', x: 160, w: 100 },
  { y: 700, kind: 'platform', x: -160, w: 100 },
  { y: 780, kind: 'platform', x: 130, w: 100 },
  { y: 860, kind: 'spike', x: -90, w: 80 },
  { y: 880, kind: 'platform', x: 110, w: 100 },
  { y: 960, kind: 'energy', x: -100 },
  { y: 1040, kind: 'platform', x: 140, w: 100 },
  { y: 1140, kind: 'platform', x: -150, w: 100 },
  { y: 1220, kind: 'shield-pickup', x: 0 },
  { y: 1280, kind: 'platform', x: 130, w: 100 },
  // Pinch — the only "rest" is a slow-pickup.
  { y: 1380, kind: 'spike', x: -180, w: 120 },
  { y: 1380, kind: 'spike', x: 80, w: 120 },
  { y: 1460, kind: 'platform', x: -40, w: 120 },
  { y: 1540, kind: 'energy', x: 80 },
  { y: 1620, kind: 'slow-pickup', x: -80 },
  { y: 1700, kind: 'platform', x: 140, w: 100 },
  { y: 1780, kind: 'platform', x: -140, w: 100 },
  { y: 1860, kind: 'platform', x: 80, w: 100 },
  { y: 1940, kind: 'platform', x: -80, w: 100 },
  { y: 2020, kind: 'energy', x: 0 },
  // Spike-rich climb.
  { y: 2100, kind: 'platform', x: 130, w: 90 },
  { y: 2180, kind: 'spike', x: -180, w: 100 },
  { y: 2180, kind: 'platform', x: 40, w: 90 },
  { y: 2260, kind: 'platform', x: -110, w: 90 },
  { y: 2340, kind: 'platform', x: 110, w: 90 },
  { y: 2420, kind: 'energy', x: -60 },
  { y: 2500, kind: 'spark', x: 100 },
  // Final spire.
  { y: 2580, kind: 'platform', x: 0, w: 140 },
  { y: 2680, kind: 'platform', x: -130, w: 90 },
  { y: 2760, kind: 'platform', x: 130, w: 90 },
  { y: 2840, kind: 'platform', x: -90, w: 90 },
  { y: 2920, kind: 'platform', x: 90, w: 90 },
  { y: 3020, kind: 'energy', x: 0 },
  { y: 3140, kind: 'platform', x: -120, w: 90 },
  { y: 3220, kind: 'platform', x: 120, w: 90 },
  { y: 3320, kind: 'spike', x: -60, w: 120 },
  { y: 3320, kind: 'platform', x: 120, w: 90 },
  { y: 3420, kind: 'energy', x: -80 },
  { y: 3540, kind: 'platform', x: 60, w: 90 },
  { y: 3640, kind: 'platform', x: -100, w: 90 },
  { y: 3740, kind: 'energy', x: 80 },
  { y: 3860, kind: 'platform', x: 0, w: 200 },
  { y: 3960, kind: 'platform', x: 0, w: 220 },
];

// ────────────────────────────────────────────────────────────────────────────
// Pendulum — 6000m. Sparse anchors, *big* arcs. No spikes. Rewards reading
// the swing line and conserving altitude through each arc. Hardest gold of
// the four because every missed energy node forces an expensive correction.
// ────────────────────────────────────────────────────────────────────────────
const pendulumRoute: CourseSpec[] = [
  // Wide opener — first three anchors set the swing rhythm.
  { y: 80, kind: 'platform', x: 0, w: 260 },
  { y: 280, kind: 'energy', x: -260 },
  { y: 360, kind: 'energy', x: 260 },
  { y: 540, kind: 'energy', x: -260 },
  { y: 720, kind: 'energy', x: 260 },
  { y: 900, kind: 'energy', x: -260 },
  // Long arcs, single anchor centred.
  { y: 1140, kind: 'energy', x: 0 },
  { y: 1340, kind: 'energy', x: -240 },
  { y: 1340, kind: 'spark', x: 240 },
  { y: 1540, kind: 'energy', x: 240 },
  { y: 1740, kind: 'energy', x: -240 },
  { y: 1740, kind: 'magnet-pickup', x: 0 },
  { y: 1940, kind: 'energy', x: 240 },
  { y: 2140, kind: 'energy', x: -240 },
  { y: 2360, kind: 'energy', x: 0 },
  // Sparse middle — the "trust the arc" section.
  { y: 2640, kind: 'energy', x: -300 },
  { y: 2900, kind: 'energy', x: 300 },
  { y: 2900, kind: 'shield-pickup', x: 0 },
  { y: 3160, kind: 'energy', x: -300 },
  { y: 3420, kind: 'energy', x: 300 },
  { y: 3680, kind: 'energy', x: 0 },
  // Pickup line — sparks string out across the swing path.
  { y: 3820, kind: 'spark', x: -120 },
  { y: 3860, kind: 'spark', x: 0 },
  { y: 3900, kind: 'spark', x: 120 },
  // Wider still — push the camera.
  { y: 4020, kind: 'energy', x: -340 },
  { y: 4280, kind: 'energy', x: 340 },
  { y: 4540, kind: 'energy', x: -340 },
  { y: 4540, kind: 'slow-pickup', x: 0 },
  { y: 4800, kind: 'energy', x: 340 },
  { y: 5060, kind: 'energy', x: -340 },
  // Final bowls — three big swings to the apex.
  { y: 5320, kind: 'energy', x: 280 },
  { y: 5580, kind: 'energy', x: -280 },
  { y: 5820, kind: 'energy', x: 280 },
  { y: 5980, kind: 'platform', x: 0, w: 320 },
];

// ────────────────────────────────────────────────────────────────────────────
// Inferno — 4500m. High hazard density. Spikes flanking nearly every anchor,
// unstable + bouncy mixed in, shield pickups placed to bail you out of one
// mistake per act. The most "arcade" of the four — fast, punishing.
// ────────────────────────────────────────────────────────────────────────────
const infernoRoute: CourseSpec[] = [
  // Cold open: shield is forced first.
  { y: 80, kind: 'platform', x: -40, w: 200 },
  { y: 200, kind: 'shield-pickup', x: 0 },
  { y: 280, kind: 'platform', x: 120, w: 140 },
  { y: 280, kind: 'spike', x: -160, w: 120 },
  { y: 420, kind: 'energy', x: -80 },
  { y: 420, kind: 'spike', x: 120, w: 80 },
  { y: 540, kind: 'bouncy', x: 160, w: 100 },
  { y: 640, kind: 'platform', x: -160, w: 120 },
  { y: 640, kind: 'spike', x: 60, w: 100 },
  // Spike corridor with timed bouncy bounce.
  { y: 780, kind: 'bouncy', x: 0, w: 120 },
  { y: 880, kind: 'spike', x: -220, w: 120 },
  { y: 880, kind: 'spike', x: 100, w: 120 },
  { y: 980, kind: 'energy', x: -40 },
  { y: 1080, kind: 'platform', x: -180, w: 100 },
  { y: 1080, kind: 'platform', x: 100, w: 100 },
  { y: 1080, kind: 'spike', x: -60, w: 80 },
  { y: 1220, kind: 'energy', x: 0 },
  { y: 1340, kind: 'spike', x: -160, w: 130 },
  { y: 1340, kind: 'spike', x: 60, w: 130 },
  { y: 1460, kind: 'platform', x: -40, w: 120 },
  { y: 1460, kind: 'shield-pickup', x: 160 },
  // Mid: hazard maze with energy oases.
  { y: 1600, kind: 'energy', x: -180 },
  { y: 1600, kind: 'energy', x: 180 },
  { y: 1740, kind: 'spike', x: -80, w: 160 },
  { y: 1860, kind: 'bouncy', x: 160, w: 100 },
  { y: 1860, kind: 'spike', x: -200, w: 100 },
  { y: 1980, kind: 'energy', x: 60 },
  { y: 2080, kind: 'platform', x: -160, w: 100 },
  { y: 2080, kind: 'spike', x: 40, w: 140 },
  { y: 2200, kind: 'energy', x: -40 },
  { y: 2200, kind: 'spike', x: 160, w: 80 },
  { y: 2340, kind: 'bouncy', x: -120, w: 100 },
  { y: 2460, kind: 'platform', x: 80, w: 120 },
  { y: 2460, kind: 'spike', x: -180, w: 100 },
  { y: 2580, kind: 'energy', x: -60 },
  { y: 2580, kind: 'slow-pickup', x: 160 },
  // Late: alternating spike walls.
  { y: 2720, kind: 'spike', x: -240, w: 140 },
  { y: 2720, kind: 'platform', x: 60, w: 120 },
  { y: 2840, kind: 'energy', x: -80 },
  { y: 2840, kind: 'spike', x: 160, w: 100 },
  { y: 2960, kind: 'bouncy', x: -160, w: 100 },
  { y: 2960, kind: 'shield-pickup', x: 100 },
  { y: 3100, kind: 'energy', x: 40 },
  { y: 3220, kind: 'spike', x: -180, w: 120 },
  { y: 3220, kind: 'spike', x: 80, w: 120 },
  { y: 3340, kind: 'platform', x: -40, w: 120 },
  { y: 3480, kind: 'energy', x: -160 },
  { y: 3480, kind: 'energy', x: 160 },
  { y: 3620, kind: 'spike', x: -60, w: 160 },
  { y: 3760, kind: 'bouncy', x: 0, w: 140 },
  { y: 3900, kind: 'energy', x: -120 },
  { y: 3900, kind: 'energy', x: 120 },
  { y: 4040, kind: 'spike', x: -200, w: 110 },
  { y: 4040, kind: 'spike', x: 100, w: 110 },
  { y: 4180, kind: 'energy', x: 0 },
  { y: 4320, kind: 'platform', x: -40, w: 140 },
  { y: 4480, kind: 'platform', x: 0, w: 240 },
];

export const TIME_ATTACK_COURSES: TimeAttackCourse[] = [
  {
    id: 'rookie',
    name: 'Rookie',
    blurb: 'A gentle 5,000m ascent. Learn the rhythm — fire, swing, fling.',
    accent: '#00ff8a',
    targetAltitude: 5000,
    medals: { gold: 80, silver: 110, bronze: 150 },
    route: rookieRoute,
  },
  {
    id: 'spire',
    name: 'The Spire',
    blurb: 'Tight 4,000m climb. Anchors sit close — keep both dashes alive.',
    accent: '#00f3ff',
    targetAltitude: 4000,
    medals: { gold: 70, silver: 95, bronze: 130 },
    route: spireRoute,
  },
  {
    id: 'pendulum',
    name: 'Pendulum',
    blurb: 'Sparse 6,000m. Big arcs, no spikes — read the swing line.',
    accent: '#a45cff',
    targetAltitude: 6000,
    medals: { gold: 95, silver: 130, bronze: 175 },
    route: pendulumRoute,
  },
  {
    id: 'inferno',
    name: 'Inferno',
    blurb: '4,500m of spike walls. Shields exist for a reason.',
    accent: '#ff255e',
    targetAltitude: 4500,
    medals: { gold: 85, silver: 115, bronze: 160 },
    route: infernoRoute,
  },
];

export const getCourse = (id: string): TimeAttackCourse =>
  TIME_ATTACK_COURSES.find((c) => c.id === id) ?? TIME_ATTACK_COURSES[0]!;

/**
 * Build the actual Obstacle[] from a course's design data. Same factory used
 * by the in-game World, lifted here so the Time Attack builder shares it.
 */
export const buildCourseLayout = (course: TimeAttackCourse): Obstacle[] => {
  let nextId = 100000;
  const obs: Obstacle[] = [];
  for (const spec of course.route) {
    const y = -spec.y * 10;
    if (spec.kind === 'platform') {
      const width = spec.w ?? 180;
      const height = spec.h ?? 20;
      obs.push(baseObstacle(nextId++, spec.x - width / 2, y, width, height, 'platform', {
        color: '#00f3ff',
        grappleable: true,
      }));
    } else if (spec.kind === 'energy') {
      const size = spec.w ?? 38;
      obs.push(baseObstacle(nextId++, spec.x - size / 2, y, size, size, 'energy', {
        color: '#a45cff',
        grappleable: true,
      }));
    } else if (spec.kind === 'bouncy') {
      const width = spec.w ?? 110;
      obs.push(baseObstacle(nextId++, spec.x - width / 2, y, width, 16, 'bouncy', {
        color: '#00ff8a',
        grappleable: true,
        bouncy: true,
      }));
    } else if (spec.kind === 'spike') {
      obs.push(baseObstacle(nextId++, spec.x - spec.w / 2, y, spec.w, 14, 'spike', {
        color: '#ff255e',
        lethal: true,
      }));
    } else {
      const size = spec.kind === 'spark' ? 16 : 28;
      const color =
        spec.kind === 'spark'
          ? '#ffd400'
          : spec.kind === 'shield-pickup'
            ? '#00ff8a'
            : spec.kind === 'magnet-pickup'
              ? '#a45cff'
              : '#a4f0ff';
      obs.push(baseObstacle(nextId++, spec.x - 14, y, size, size, spec.kind, {
        color,
        pickup: true,
      }));
    }
  }
  return obs;
};

const baseObstacle = (
  id: number,
  x: number,
  y: number,
  width: number,
  height: number,
  kind: ObstacleKind,
  flags: {
    color: string;
    grappleable?: boolean;
    lethal?: boolean;
    bouncy?: boolean;
    pickup?: boolean;
  },
): Obstacle => ({
  id,
  x,
  y,
  width,
  height,
  kind,
  color: flags.color,
  grappleable: flags.grappleable ?? false,
  lethal: flags.lethal ?? false,
  bouncy: flags.bouncy ?? false,
  pickup: flags.pickup ?? false,
  collected: false,
  unstableTimer: 0,
  unstableTriggered: false,
  amp: 0,
  driftAngle: 0,
  driftSpeed: 0,
  lastX: x,
  pulse: 0,
  variant: 0,
  seedPhase: 0,
});
