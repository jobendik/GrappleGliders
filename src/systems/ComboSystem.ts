/**
 * Combo manager: chains grapples that connect within COMBO_WINDOW seconds of releasing the last hook.
 * Multiplier cap (×10) keeps scores readable.
 */
const COMBO_WINDOW_FRAMES = 1.5 * 60; // 1.5s assuming 60fps; we measure in update-frames so this matches.

export class ComboSystem {
  combo = 1;
  peak = 1;
  /** Frames remaining in the chain window. 0 = no chain active. */
  window = 0;
  /** Lifetime grapples landed this run (for stats). */
  hooksLanded = 0;
  /** Lifetime perfect anchors this run. */
  perfectAnchors = 0;
  /** Lifetime near-misses (debounced per-obstacle). */
  nearMisses = 0;

  reset(): void {
    this.combo = 1;
    this.peak = 1;
    this.window = 0;
    this.hooksLanded = 0;
    this.perfectAnchors = 0;
    this.nearMisses = 0;
  }

  /** Tick the chain window down. Returns true if the chain expired this tick. */
  update(dt: number): boolean {
    if (this.window <= 0) return false;
    this.window -= dt;
    if (this.window <= 0) {
      this.combo = 1;
      this.window = 0;
      return true;
    }
    return false;
  }

  onHookConnect(perfectAnchor: boolean): void {
    this.hooksLanded += 1;
    if (perfectAnchor) this.perfectAnchors += 1;
    // Connecting starts/extends the window.
    this.window = COMBO_WINDOW_FRAMES;
  }

  onHookRelease(): void {
    // Releasing while window still active extends combo.
    if (this.window > 0) {
      this.combo = Math.min(10, this.combo + 1);
      this.peak = Math.max(this.peak, this.combo);
      this.window = COMBO_WINDOW_FRAMES;
    }
  }

  onMissOrTouch(): void {
    this.combo = 1;
    this.window = 0;
  }

  onNearMiss(): void {
    this.nearMisses += 1;
  }
}
