import { describe, expect, it } from 'vitest';
import { ScoringSystem } from '../src/systems/ScoringSystem';
import { ComboSystem } from '../src/systems/ComboSystem';

describe('ScoringSystem', () => {
  it('computes altitude score as floor(altitude) * 10', () => {
    const s = new ScoringSystem();
    s.updateAltitude(123.7);
    expect(s.altitudeScore).toBe(1230);
    expect(s.total).toBe(1230);
  });

  it('adds bonus scaled by current combo', () => {
    const s = new ScoringSystem();
    s.setCombo(3);
    s.addBonus(100);
    expect(s.bonusScore).toBe(300);
    expect(s.total).toBe(300);
  });

  it('tracks peak combo', () => {
    const s = new ScoringSystem();
    s.setCombo(2);
    s.setCombo(5);
    s.setCombo(3);
    expect(s.peakCombo).toBe(5);
  });

  it('resets cleanly', () => {
    const s = new ScoringSystem();
    s.updateAltitude(200);
    s.addBonus(50);
    s.reset();
    expect(s.total).toBe(0);
    expect(s.combo).toBe(1);
  });
});

describe('ComboSystem', () => {
  it('starts at combo 1 with no chain window', () => {
    const c = new ComboSystem();
    expect(c.combo).toBe(1);
    expect(c.window).toBe(0);
  });

  it('extends window on hook connect', () => {
    const c = new ComboSystem();
    c.onHookConnect(false);
    expect(c.window).toBeGreaterThan(0);
    expect(c.hooksLanded).toBe(1);
  });

  it('increments combo on release within window, caps at 10', () => {
    const c = new ComboSystem();
    for (let i = 0; i < 20; i++) {
      c.onHookConnect(false);
      c.onHookRelease();
    }
    expect(c.combo).toBe(10);
    expect(c.peak).toBe(10);
  });

  it('drops combo to 1 after window expires', () => {
    const c = new ComboSystem();
    c.onHookConnect(false);
    c.onHookRelease();
    expect(c.combo).toBeGreaterThan(1);
    // burn through the window
    for (let i = 0; i < 200; i++) c.update(1);
    expect(c.combo).toBe(1);
  });

  it('counts perfect anchors and near misses separately', () => {
    const c = new ComboSystem();
    c.onHookConnect(true);
    c.onHookConnect(false);
    c.onNearMiss();
    c.onNearMiss();
    expect(c.perfectAnchors).toBe(1);
    expect(c.nearMisses).toBe(2);
  });

  it('onMissOrTouch resets combo immediately', () => {
    const c = new ComboSystem();
    c.onHookConnect(false);
    c.onHookRelease();
    c.onMissOrTouch();
    expect(c.combo).toBe(1);
    expect(c.window).toBe(0);
  });
});
