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
  private lavaRoar: {
    src: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;
  /** Cached noise buffer for lava roar / whooshes. Built lazily once. */
  private noiseBuffer: AudioBuffer | null = null;

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
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const buffer = this.engine.assets.get('sfx:whip');
    if (!buffer) {
      // Buffer still decoding (first frame after audio unlock). Kick off the
      // load so the next fire has it, and use the procedural blip in the
      // meantime so the action isn't silent.
      void this.engine.assets.load('sfx:whip');
      this.blip('hookFire', { freq: 320, duration: 0.06, type: 'sawtooth', gain: 0.04, slide: 220 });
      return;
    }
    if (!this.canPlay('hookFire', 60)) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    // Slight randomised pitch/gain so repeated fires don't sound robotic.
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    gain.gain.value = 0.9;
    src.buffer = buffer;
    src.connect(gain).connect(dest);
    src.start(0);
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

  /**
   * Death: layered descending sequence + low rumble + filtered noise crash.
   * Punctuates the loss with weight rather than a thin blip sequence.
   */
  death(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Descending sawtooth sequence — the original "tonal failure" stack.
    [220, 180, 140, 100, 70].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, now + i * 0.07);
      g.gain.setValueAtTime(0.0001, now + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.08, now + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.22);
      o.connect(g).connect(dest);
      o.start(now + i * 0.07);
      o.stop(now + i * 0.07 + 0.28);
    });
    // Sub-rumble underneath: 50→30Hz sine that drops with the descent — gives weight.
    const rumble = ctx.createOscillator();
    const rumbleG = ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(60, now);
    rumble.frequency.exponentialRampToValueAtTime(28, now + 0.7);
    rumbleG.gain.setValueAtTime(0.0001, now);
    rumbleG.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
    rumbleG.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    rumble.connect(rumbleG).connect(dest);
    rumble.start(now);
    rumble.stop(now + 0.8);
    // Filtered-noise crash at the head — the "impact" transient.
    const noiseBuf = this.getNoiseBuffer();
    if (noiseBuf) {
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noiseBuf;
      src.loop = false;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(220, now + 0.35);
      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.45);
    }
  }

  /**
   * Perfect anchor: distinctive 3-note ascending arpeggio with shimmer.
   * Reads as "skill recognised" — separate from combo chime so the player
   * learns the connection: precision → bell sound.
   */
  perfectAnchor(): void {
    if (!this.canPlay('perfectAnchor', 80)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // C5 → E5 → G5 arpeggio — clean major triad.
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o2.type = 'sine';
      o.frequency.setValueAtTime(f, now + i * 0.06);
      o2.frequency.setValueAtTime(f * 2, now + i * 0.06);
      g.gain.setValueAtTime(0.0001, now + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.06, now + i * 0.06 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.22);
      o.connect(g).connect(dest);
      o2.connect(g);
      o.start(now + i * 0.06);
      o2.start(now + i * 0.06);
      o.stop(now + i * 0.06 + 0.24);
      o2.stop(now + i * 0.06 + 0.24);
    });
    // Shimmer tail: short filtered-noise sheen that lingers.
    const noiseBuf = this.getNoiseBuffer();
    if (noiseBuf) {
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noiseBuf;
      filter.type = 'highpass';
      filter.frequency.value = 4000;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.04, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.55);
    }
  }

  /**
   * Level-up fanfare: 4-note rising sequence with octave doubling and bloom.
   * Plays once on end-of-run when a level boundary is crossed.
   */
  levelUp(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // C5 → E5 → G5 → C6 — triumphant resolution.
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o2.type = 'sawtooth';
      o.frequency.setValueAtTime(f, now + i * 0.09);
      o2.frequency.setValueAtTime(f * 0.5, now + i * 0.09); // sub-octave
      g.gain.setValueAtTime(0.0001, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.08, now + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.26);
      o.connect(g).connect(dest);
      o2.connect(g);
      o.start(now + i * 0.09);
      o2.start(now + i * 0.09);
      o.stop(now + i * 0.09 + 0.28);
      o2.stop(now + i * 0.09 + 0.28);
    });
  }

  /**
   * Generic unlock chime — used for pickups, achievements, theme unlocks.
   * Kept for compatibility; level-up is now its own distinct fanfare.
   */
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

  /**
   * Trick-detected stab: short, punchy 2-note flourish. Distinct from combo
   * so trick callouts feel like their own thing.
   */
  trick(intensity: number = 1): void {
    if (!this.canPlay('trick', 90)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const base = 540 + intensity * 80;
    // Quick falling 5th — playful.
    [base * 1.5, base].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(f, now + i * 0.05);
      g.gain.setValueAtTime(0.0001, now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.05, now + i * 0.05 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.13);
      o.connect(g).connect(dest);
      o.start(now + i * 0.05);
      o.stop(now + i * 0.05 + 0.15);
    });
  }

  /**
   * Boss-wave alarm — descending klaxon pulse. Designed to read as "danger
   * incoming." Plays once when a boss wave triggers.
   */
  bossAlert(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Two-tone alarm sweep: 880↔660 oscillating twice, then a low drop.
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      const f = i % 2 === 0 ? 880 : 660;
      o.frequency.setValueAtTime(f, now + i * 0.13);
      g.gain.setValueAtTime(0.0001, now + i * 0.13);
      g.gain.exponentialRampToValueAtTime(0.09, now + i * 0.13 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.13 + 0.12);
      o.connect(g).connect(dest);
      o.start(now + i * 0.13);
      o.stop(now + i * 0.13 + 0.15);
    }
    // Closing bass drop for impact.
    const drop = ctx.createOscillator();
    const dropG = ctx.createGain();
    drop.type = 'sine';
    drop.frequency.setValueAtTime(160, now + 0.55);
    drop.frequency.exponentialRampToValueAtTime(50, now + 0.95);
    dropG.gain.setValueAtTime(0.0001, now + 0.55);
    dropG.gain.exponentialRampToValueAtTime(0.16, now + 0.6);
    dropG.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    drop.connect(dropG).connect(dest);
    drop.start(now + 0.55);
    drop.stop(now + 1.05);
  }

  /**
   * Ambient lava roar — a continuous filtered-noise loop that fades in/out
   * with lava proximity. Pass intensity 0..1 each frame. The loop is started
   * lazily on first non-zero call and gain-modulated thereafter.
   */
  setLavaRoarIntensity(intensity: number): void {
    const target = Math.max(0, Math.min(1, intensity));
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) {
      // Audio not unlocked yet — wait until next call. No allocations.
      return;
    }
    if (!this.lavaRoar && target > 0.01) {
      this.lavaRoar = this.startLavaRoar(ctx, dest);
    }
    if (!this.lavaRoar) return;
    const now = ctx.currentTime;
    // Smoothly ramp to the requested intensity. Max gain ~0.18 — felt rather
    // than heard so it doesn't mud the music.
    const gainTarget = target * 0.18;
    this.lavaRoar.gain.gain.cancelScheduledValues(now);
    this.lavaRoar.gain.gain.setTargetAtTime(gainTarget, now, 0.18);
    // Sharper filter when closer — adds heat brightness.
    const cutoff = 400 + target * 1100;
    this.lavaRoar.filter.frequency.setTargetAtTime(cutoff, now, 0.25);
  }

  /** Tear down the ambient lava loop. Call when leaving a lava mode. */
  stopLavaRoar(): void {
    if (!this.lavaRoar) return;
    const ctx = this.engine.ctx;
    if (!ctx) {
      this.lavaRoar = null;
      return;
    }
    const now = ctx.currentTime;
    this.lavaRoar.gain.gain.cancelScheduledValues(now);
    this.lavaRoar.gain.gain.setTargetAtTime(0, now, 0.15);
    const src = this.lavaRoar.src;
    this.lavaRoar = null;
    setTimeout(() => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }, 400);
  }

  private startLavaRoar(
    ctx: AudioContext,
    dest: AudioNode,
  ): { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } {
    const buf = this.getNoiseBuffer();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    // A second low-shelf to add a sub-band rumble for body.
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'lowshelf';
    shelf.frequency.value = 120;
    shelf.gain.value = 9;
    src.connect(filter).connect(shelf).connect(gain).connect(dest);
    src.start();
    return { src, filter, gain };
  }

  /**
   * Return (and cache) a 2-second pink-ish noise buffer for use across SFX.
   * Pink-ish: simple running-sum filter on white noise — cheap and warmer
   * than raw white for "roar" / "crash" textures.
   */
  private getNoiseBuffer(): AudioBuffer | null {
    if (this.noiseBuffer) return this.noiseBuffer;
    const ctx = this.engine.ctx;
    if (!ctx) return null;
    const sr = ctx.sampleRate;
    const dur = 2.0;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buf.getChannelData(0);
    // Voss-McCartney pink-noise approximation, lightweight.
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  buttonClick(): void {
    this.blip('btn', { freq: 880, duration: 0.05, type: 'square', gain: 0.025, slide: 220 });
  }
}
