export type HapticEvent =
  | 'hookConnect'
  | 'dash'
  | 'nearMiss'
  | 'death'
  | 'unlock'
  | 'bounce'
  | 'comboMilestone';

const PATTERNS: Record<HapticEvent, number | number[]> = {
  hookConnect: 8,
  dash: 20,
  nearMiss: 5,
  bounce: 12,
  comboMilestone: [12, 30, 12],
  death: [40, 80, 40, 80, 120],
  unlock: [30, 80, 30, 80, 60, 200],
};

export class HapticsSystem {
  enabled = true;

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  trigger(event: HapticEvent): void {
    if (!this.enabled) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
      navigator.vibrate(PATTERNS[event]);
    } catch {
      // ignore — some browsers reject without user gesture
    }
  }
}
