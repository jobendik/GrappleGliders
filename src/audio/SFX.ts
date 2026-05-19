import type { AudioEngine } from './AudioEngine';

interface BlipOpts {
  freq?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  slide?: number;
}

export class SFX {
  private lastTrigger: Record<string, number> = {};

  constructor(private engine: AudioEngine) {}

  private canPlay(tag: string, minGapMs: number = 30): boolean {
    const now = performance.now();
    if (now - (this.lastTrigger[tag] ?? 0) < minGapMs) return false;
    this.lastTrigger[tag] = now;
    return true;
  }

  blip(tag: string, opts: BlipOpts = {}): void {
    if (!this.canPlay(tag, 24)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    const f = opts.freq ?? 440;
    const dur = opts.duration ?? 0.07;
    const gain = opts.gain ?? 0.05;
    osc.frequency.setValueAtTime(f, now);
    if (opts.slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, f + opts.slide), now + dur);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(dest);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  hookFire(): void {
    this.blip('hookFire', { freq: 320, duration: 0.06, type: 'sawtooth', gain: 0.04, slide: 220 });
  }

  hookConnect(distance: number): void {
    const pitch = Math.max(0.6, Math.min(1.4, 1 - distance / 1500));
    this.blip('hookConnect', { freq: 620 * pitch, duration: 0.08, type: 'square', gain: 0.04, slide: 320 });
  }

  hookRelease(): void {
    this.blip('hookRelease', { freq: 260, duration: 0.07, type: 'triangle', gain: 0.03, slide: -120 });
  }

  swingWhoosh(velocity: number): void {
    if (!this.canPlay('whoosh', 110)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const sr = ctx.sampleRate;
    const dur = 0.18;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.4;
    }
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800 + velocity * 30;
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = Math.min(0.08, 0.015 + velocity * 0.002);
    src.buffer = buf;
    src.connect(filter).connect(g).connect(dest);
    src.start();
  }

  dash(): void {
    this.blip('dash', { freq: 200, duration: 0.12, type: 'sawtooth', gain: 0.05, slide: 400 });
  }

  nearMiss(): void {
    this.blip('nearMiss', { freq: 1180, duration: 0.06, type: 'sine', gain: 0.03, slide: 360 });
  }

  combo(level: number): void {
    if (!this.canPlay('combo', 70)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const base = 320 + level * 60;
    [0, 0.04, 0.08].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(base * (i + 1) * 0.7, now + t);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.035, now + t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.1);
      o.connect(g).connect(dest);
      o.start(now + t);
      o.stop(now + t + 0.12);
    });
  }

  bounce(): void {
    this.blip('bounce', { freq: 540, duration: 0.08, type: 'square', gain: 0.05, slide: 160 });
  }

  death(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    [220, 180, 140, 100].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, now + i * 0.07);
      g.gain.setValueAtTime(0.0001, now + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.07, now + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.2);
      o.connect(g).connect(dest);
      o.start(now + i * 0.07);
      o.stop(now + i * 0.07 + 0.25);
    });
  }

  unlock(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, now + i * 0.09);
      g.gain.setValueAtTime(0.0001, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.06, now + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.18);
      o.connect(g).connect(dest);
      o.start(now + i * 0.09);
      o.stop(now + i * 0.09 + 0.2);
    });
  }

  buttonClick(): void {
    this.blip('btn', { freq: 880, duration: 0.05, type: 'square', gain: 0.025, slide: 220 });
  }
}
