/**
 * Mulberry32 — a tiny, fast 32-bit PRNG with good distribution for game seeding.
 * Same seed produces the same sequence on every device and run.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    // Avoid the degenerate state=0 trap by mixing in a known constant.
    this.state = (seed | 0) ^ 0x6d2b79f5;
  }

  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    const idx = Math.floor(this.next() * arr.length);
    return arr[idx]!;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  reseed(seed: number): void {
    this.state = (seed | 0) ^ 0x6d2b79f5;
  }
}

export const makeDailySeed = (yyyymmdd: number, modeId: string): number => {
  let h = yyyymmdd | 0;
  for (let i = 0; i < modeId.length; i++) {
    h = ((h << 5) - h + modeId.charCodeAt(i)) | 0;
  }
  return h >>> 0;
};
