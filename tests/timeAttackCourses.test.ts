import { describe, expect, it } from 'vitest';
import {
  TIME_ATTACK_COURSES,
  buildCourseLayout,
  getCourse,
} from '../src/content/timeAttackCourses';
import { getTheme } from '../src/content/themes';

describe('Time Attack courses', () => {
  it('exposes four distinct courses', () => {
    expect(TIME_ATTACK_COURSES).toHaveLength(4);
    const ids = TIME_ATTACK_COURSES.map((c) => c.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(['rookie', 'spire', 'pendulum', 'inferno']);
  });

  it('every course resolves to a valid theme', () => {
    for (const course of TIME_ATTACK_COURSES) {
      const theme = getTheme(course.themeId);
      expect(theme.id).toBe(course.themeId);
    }
  });

  it('courses use mutually distinct themes', () => {
    const themes = TIME_ATTACK_COURSES.map((c) => c.themeId);
    expect(new Set(themes).size).toBe(themes.length);
  });

  it('routes are non-trivial and unique', () => {
    const seenSignatures = new Set<string>();
    for (const course of TIME_ATTACK_COURSES) {
      expect(course.route.length).toBeGreaterThan(10);
      // Hash the route into a string so identical routes collide.
      const sig = course.route
        .map((r) => `${r.kind}:${r.y}:${r.x}`)
        .join('|');
      expect(seenSignatures.has(sig)).toBe(false);
      seenSignatures.add(sig);
    }
  });

  it('pendulum truly has no spikes', () => {
    const pendulum = getCourse('pendulum');
    const spikes = pendulum.route.filter((r) => r.kind === 'spike');
    expect(spikes.length).toBe(0);
  });

  it('inferno is hazard-rich', () => {
    const inferno = getCourse('inferno');
    const spikes = inferno.route.filter((r) => r.kind === 'spike');
    expect(spikes.length).toBeGreaterThan(15);
  });

  it('every course route reaches its target altitude band', () => {
    for (const course of TIME_ATTACK_COURSES) {
      const maxY = Math.max(...course.route.map((r) => r.y));
      // Final stepping stone should be near but at or below the target so the
      // visible finish-line marker is the actual goal.
      expect(maxY).toBeGreaterThanOrEqual(course.targetAltitude - 200);
      expect(maxY).toBeLessThanOrEqual(course.targetAltitude);
    }
  });

  it('buildCourseLayout includes starting platforms and produces unique obstacle ids', () => {
    const rookieLayout = buildCourseLayout(getCourse('rookie'));
    const spireLayout = buildCourseLayout(getCourse('spire'));
    const allIds = [...rookieLayout, ...spireLayout].map((o) => o.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('buildCourseLayout includes a wide starting pad below the spawn (world y > -120)', () => {
    for (const course of TIME_ATTACK_COURSES) {
      const layout = buildCourseLayout(course);
      // Spawn pad should sit below the player spawn (world y > -120) so
      // they land on it instead of falling out.
      const padCandidates = layout.filter((o) => o.y > -120 && o.kind === 'platform');
      expect(padCandidates.length).toBeGreaterThan(0);
    }
  });

  it('buildCourseLayout marks spikes lethal and pickups non-blocking', () => {
    const inferno = buildCourseLayout(getCourse('inferno'));
    const spike = inferno.find((o) => o.kind === 'spike');
    const pickup = inferno.find((o) => o.kind === 'shield-pickup');
    expect(spike).toBeDefined();
    expect(spike!.lethal).toBe(true);
    expect(spike!.grappleable).toBe(false);
    expect(pickup).toBeDefined();
    expect(pickup!.pickup).toBe(true);
    expect(pickup!.lethal).toBe(false);
  });

  it('medal thresholds form a strict bronze>silver>gold ladder', () => {
    for (const course of TIME_ATTACK_COURSES) {
      expect(course.medals.gold).toBeLessThan(course.medals.silver);
      expect(course.medals.silver).toBeLessThan(course.medals.bronze);
    }
  });
});
