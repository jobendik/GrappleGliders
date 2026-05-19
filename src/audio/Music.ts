import type { AudioEngine } from './AudioEngine';

interface ThemeMusic {
  scale: number[]; // semitone offsets
  rootHz: number;
  tempo: number; // bpm
  pad: OscillatorType;
  lead: OscillatorType;
}

const THEME_MUSIC: Record<string, ThemeMusic> = {
  synthwave: { scale: [0, 3, 5, 7, 10], rootHz: 110, tempo: 96, pad: 'sawtooth', lead: 'square' },
  vaporwave: { scale: [0, 2, 5, 7, 9], rootHz: 98, tempo: 84, pad: 'triangle', lead: 'sine' },
  'cyber-noir': { scale: [0, 2, 3, 7, 10], rootHz: 82, tempo: 110, pad: 'sawtooth', lead: 'sawtooth' },
  'neon-jungle': { scale: [0, 2, 4, 7, 9], rootHz: 130, tempo: 120, pad: 'triangle', lead: 'triangle' },
  'blood-moon': { scale: [0, 1, 5, 6, 8], rootHz: 87, tempo: 88, pad: 'sawtooth', lead: 'square' },
  'ice-station': { scale: [0, 2, 5, 7, 11], rootHz: 120, tempo: 102, pad: 'triangle', lead: 'sine' },
};

const noteToHz = (root: number, semis: number): number => root * Math.pow(2, semis / 12);

export class Music {
  private engine: AudioEngine;
  private currentTheme: string | null = null;
  private bus: GainNode | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private beatIndex = 0;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  play(themeId: string): void {
    if (this.currentTheme === themeId) return;
    this.stop();
    if (!this.engine.ctx || !this.engine.musicDest) return;
    const def = THEME_MUSIC[themeId] ?? THEME_MUSIC.synthwave!;
    this.currentTheme = themeId;
    const ctx = this.engine.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 2);
    bus.connect(this.engine.musicDest);
    this.bus = bus;
    this.startTime = ctx.currentTime;
    this.beatIndex = 0;
    const beatSec = 60 / def.tempo;
    this.scheduler = setInterval(() => this.schedule(def, beatSec), 200);
  }

  private schedule(def: ThemeMusic, beatSec: number): void {
    const ctx = this.engine.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const lookahead = 0.45;
    const now = ctx.currentTime;
    while (this.startTime + this.beatIndex * beatSec < now + lookahead) {
      const t = this.startTime + this.beatIndex * beatSec;
      this.playBeat(def, t, beatSec, this.beatIndex);
      this.beatIndex += 1;
    }
  }

  private playBeat(def: ThemeMusic, t: number, beatSec: number, idx: number): void {
    const ctx = this.engine.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    // Bassline: root on beats 0 and 2
    if (idx % 4 === 0 || idx % 4 === 2) {
      const bass = ctx.createOscillator();
      const g = ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.value = def.rootHz / 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + beatSec * 0.9);
      bass.connect(g).connect(bus);
      bass.start(t);
      bass.stop(t + beatSec);
    }
    // Pad chord every 4 beats
    if (idx % 8 === 0) {
      [0, 4, 7].forEach((s) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = def.pad;
        o.frequency.value = noteToHz(def.rootHz, s);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + beatSec * 7.8);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + beatSec * 8);
      });
    }
    // Arpeggio every beat
    const scale = def.scale;
    const step = scale[idx % scale.length]!;
    const octave = (Math.floor(idx / scale.length) % 3) + 1;
    const lead = ctx.createOscillator();
    const lg = ctx.createGain();
    lead.type = def.lead;
    lead.frequency.value = noteToHz(def.rootHz, step + octave * 12);
    lg.gain.setValueAtTime(0.0001, t);
    lg.gain.exponentialRampToValueAtTime(0.045, t + 0.01);
    lg.gain.exponentialRampToValueAtTime(0.0001, t + beatSec * 0.6);
    lead.connect(lg).connect(bus);
    lead.start(t);
    lead.stop(t + beatSec * 0.7);
  }

  setVolume(v: number): void {
    if (!this.bus) return;
    this.bus.gain.value = Math.max(0, Math.min(1, v));
  }

  stop(): void {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    if (this.bus && this.engine.ctx) {
      const ctx = this.engine.ctx;
      const bus = this.bus;
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      setTimeout(() => bus.disconnect(), 500);
    }
    this.bus = null;
    this.currentTheme = null;
  }
}
