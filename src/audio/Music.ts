import type { AudioEngine } from './AudioEngine';
import type { AudioAssetKey } from './AudioAssets';

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

// Per-theme MP3 mapping. Every shipped theme now has a commissioned track;
// the procedural generator below is kept as a fallback for any future theme
// that ships before its track is generated.
const THEME_MP3: Record<string, AudioAssetKey> = {
  synthwave: 'music:synthwave',
  vaporwave: 'music:vaporwave',
  'cyber-noir': 'music:cyber-noir',
  'blood-moon': 'music:blood-moon',
  'ice-station': 'music:ice-station',
  'neon-jungle': 'music:neon-jungle',
};

const noteToHz = (root: number, semis: number): number => root * Math.pow(2, semis / 12);

export class Music {
  private engine: AudioEngine;
  private currentTheme: string | null = null;
  private bus: GainNode | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private beatIndex = 0;
  /** Active MP3 source node when streaming the licensed soundtrack. */
  private mp3Source: AudioBufferSourceNode | null = null;
  /** Cached target intensity, applied once the bus is mounted. */
  private pendingIntensity: number | null = null;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  play(themeId: string): void {
    if (this.currentTheme === themeId) return;
    this.stop();
    const ctx = this.engine.ctx;
    if (!ctx || !this.engine.musicDest) return;
    this.currentTheme = themeId;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 2);
    bus.connect(this.engine.musicDest);
    this.bus = bus;

    const assetKey = THEME_MP3[themeId];
    if (assetKey) {
      // Try the MP3 first; fall back to procedural if the load fails.
      void this.startMp3(themeId, assetKey);
      return;
    }
    this.startProcedural(themeId);
  }

  /**
   * Plays the menu/lobby loop. Separate from `play()` so the lobby can use
   * its own ramp & doesn't have to share the THEME_MUSIC table.
   */
  playMenu(): void {
    if (this.currentTheme === 'menu') return;
    this.stop();
    const ctx = this.engine.ctx;
    if (!ctx || !this.engine.musicDest) return;
    this.currentTheme = 'menu';
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.2);
    bus.connect(this.engine.musicDest);
    this.bus = bus;
    void this.startMp3('menu', 'music:menu');
  }

  private async startMp3(themeId: string, key: AudioAssetKey): Promise<void> {
    const buffer = await this.engine.assets.load(key);
    // The user may have switched themes / stopped during the load.
    if (this.currentTheme !== themeId || !this.bus || !this.engine.ctx) return;
    if (!buffer) {
      // Menu has no procedural fallback — just stay silent.
      if (themeId === 'menu') return;
      this.startProcedural(themeId);
      return;
    }
    const ctx = this.engine.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.bus);
    src.start(0);
    this.mp3Source = src;
    if (this.pendingIntensity !== null) {
      this.setIntensity(this.pendingIntensity);
      this.pendingIntensity = null;
    }
  }

  private startProcedural(themeId: string): void {
    const def = THEME_MUSIC[themeId] ?? THEME_MUSIC.synthwave!;
    const ctx = this.engine.ctx;
    if (!ctx) return;
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

  /** 0..1 — eased volume scale used to swell the music as combo rises. */
  setIntensity(t: number): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    if (!this.bus) {
      this.pendingIntensity = t;
      return;
    }
    // The MP3 already has its own arrangement, so the intensity ramp is narrower
    // (0.55–0.85) to avoid pumping the master. Procedural music gets the wider
    // range so the original combo lift still feels present.
    const usingMp3 = this.mp3Source !== null;
    const lo = usingMp3 ? 0.55 : 0.32;
    const hi = usingMp3 ? 0.85 : 0.72;
    const target = lo + Math.max(0, Math.min(1, t)) * (hi - lo);
    this.bus.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
  }

  stop(): void {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    if (this.mp3Source) {
      try { this.mp3Source.stop(); } catch { /* already stopped */ }
      try { this.mp3Source.disconnect(); } catch { /* already disconnected */ }
      this.mp3Source = null;
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
    this.pendingIntensity = null;
  }
}
