export interface ScoreBreakdown {
  altitude: number;
  bonus: number;
  comboMultiplier: number;
  total: number;
}

export class ScoringSystem {
  altitudeScore = 0;
  bonusScore = 0;
  combo = 1;
  peakCombo = 1;

  reset(): void {
    this.altitudeScore = 0;
    this.bonusScore = 0;
    this.combo = 1;
    this.peakCombo = 1;
  }

  updateAltitude(maxAltitude: number): void {
    this.altitudeScore = Math.floor(maxAltitude) * 10;
  }

  addBonus(points: number): void {
    this.bonusScore += Math.floor(points * this.combo);
  }

  /**
   * Add already-multiplied points (e.g. trick scores from TrickSystem, which
   * baked the combo multiplier into the event score). Avoids double-counting
   * the combo by skipping the inner `* this.combo`.
   */
  addRawBonus(points: number): void {
    this.bonusScore += Math.floor(points);
  }

  setCombo(combo: number): void {
    this.combo = combo;
    if (combo > this.peakCombo) this.peakCombo = combo;
  }

  get total(): number {
    return Math.floor(this.altitudeScore + this.bonusScore);
  }

  get breakdown(): ScoreBreakdown {
    return {
      altitude: this.altitudeScore,
      bonus: this.bonusScore,
      comboMultiplier: this.combo,
      total: this.total,
    };
  }
}
