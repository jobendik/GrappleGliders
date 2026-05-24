import { describe, expect, it } from 'vitest';
import { resolveGameOverPresentation, type GameOverContext } from '../src/ui/GameOverScreen';
import { GameMode } from '../src/game/GameState';

const baseCtx: GameOverContext = {
  mode: GameMode.EndlessClimb,
  cause: 'Consumed by the lava',
  score: 1200,
  altitude: 420,
  peakCombo: 4,
  perfectAnchors: 2,
  nearMisses: 1,
  newBestAltitude: false,
  newBestScore: false,
  newBestTime: false,
  elapsedSeconds: 38,
  rewards: { xp: 10, sparks: 4, bonusXp: 0, levelUps: [] },
  canRevive: true,
  adsAvailable: true,
  dailyStreak: 0,
};

describe('resolveGameOverPresentation', () => {
  it('uses revive-aware retry defaults', () => {
    const copy = resolveGameOverPresentation(baseCtx, true);
    expect(copy.retryLabel).toBe('Fresh Run');
    expect(copy.reviveLabel).toBe('Keep This Run');
    expect(copy.reviveSub).toContain('continue');
  });

  it('prefers explicit contextual overrides', () => {
    const copy = resolveGameOverPresentation(
      {
        ...baseCtx,
        eyebrow: 'Close Call',
        nudge: 'Only 20m short of 500m.',
        reviveLabel: 'Push to 500m',
        reviveSub: 'Resume from the checkpoint',
      },
      true,
    );
    expect(copy.eyebrow).toBe('Close Call');
    expect(copy.nudge).toBe('Only 20m short of 500m.');
    expect(copy.reviveLabel).toBe('Push to 500m');
  });
});