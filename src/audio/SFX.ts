import type { AudioEngine } from './AudioEngine';

interface BlipOpts {
  freq?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  slide?: number;
}

/** State for a persistent looped ambient sound. */
interface LoopedSound {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class SFX {
  private lastTrigger: Record<string, number> = {};
  private lavaLoop: LoopedSound | null = null;
  private windLoop: LoopedSound | null = null;
  /** Cached long noise buffer per AudioContext (avoid reallocating 3-second buffers). */
  private cachedNoiseBuf = new WeakMap<AudioContext, AudioBuffer>();

  constructor(private engine: AudioEngine) {}

  private canPlay(tag: string, minGapMs = 30): boolean {
    const now = performance.now();
    if (now - (this.lastTrigger[tag] ?? 0) < minGapMs) return false;
    this.lastTrigger[tag] = now;
    return true;
  }

  // ── Noise helpers ──────────────────────────────────────────────

  /** Returns a cached 3-second noise buffer for looped sounds. */
  private getNoiseBuf(ctx: AudioContext): AudioBuffer {
    const cached = this.cachedNoiseBuf.get(ctx);
    if (cached) return cached;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 3, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.cachedNoiseBuf.set(ctx, buf);
    return buf;
  }

  /** Create a short one-shot noise buffer. */
  private shortNoise(ctx: AudioContext, duration: number): AudioBuffer {
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * duration));
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── General-purpose blip ───────────────────────────────────────

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

  // ── Core gameplay SFX ─────────────────────────────────────────

  hookFire(): void {
    if (!this.canPlay('hookFire', 60)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Layer 1: sharp crack — short noise burst through a bandpass filter
    {
      const buf = this.shortNoise(ctx, 0.06);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.value = 2800;
      filter.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.18, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.08);
    }
    // Layer 2: pitch whip — sawtooth sliding from high to low
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.07, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  }

  hookConnect(distance: number): void {
    if (!this.canPlay('hookConnect', 30)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const pitch = Math.max(0.6, Math.min(1.4, 1 - distance / 1500));
    // Metallic noise impact
    {
      const buf = this.shortNoise(ctx, 0.05);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.value = 1200 * pitch;
      filter.Q.value = 2;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.1, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.07);
    }
    // Ring tone
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(640 * pitch, now);
      osc.frequency.exponentialRampToValueAtTime(480 * pitch, now + 0.09);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.055, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.11);
    }
  }

  hookRelease(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.045, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(g).connect(dest);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  swingWhoosh(velocity: number): void {
    if (!this.canPlay('whoosh', 110)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const sr = ctx.sampleRate;
    const dur = 0.22;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.5;
    }
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const hp = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400 + velocity * 40, now);
    filter.frequency.exponentialRampToValueAtTime(1200 + velocity * 60, now + 0.1);
    filter.Q.value = 0.6;
    hp.type = 'highpass';
    hp.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.value = Math.min(0.1, 0.02 + velocity * 0.003);
    src.buffer = buf;
    src.connect(filter).connect(hp).connect(g).connect(dest);
    src.start(now);
  }

  dash(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    if (!this.canPlay('dash', 80)) return;
    const now = ctx.currentTime;
    // Noise whoosh sweep
    {
      const buf = this.shortNoise(ctx, 0.18);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.1);
      filter.Q.value = 0.5;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.2);
    }
    // Sub-bass thud
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.09, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  }

  nearMiss(): void {
    this.blip('nearMiss', { freq: 1400, duration: 0.055, type: 'sine', gain: 0.035, slide: 420 });
  }

  combo(level: number): void {
    if (!this.canPlay('combo', 70)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const base = 280 + level * 70;
    [0, 0.045, 0.09].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i === 2 ? 'triangle' : 'square';
      o.frequency.setValueAtTime(base * (i + 1) * 0.68, now + t);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.04 + level * 0.003, now + t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.12);
      o.connect(g).connect(dest);
      o.start(now + t);
      o.stop(now + t + 0.14);
    });
  }

  bounce(): void {
    if (!this.canPlay('bounce', 40)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(g).connect(dest);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  death(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Dramatic descending tones
    [240, 190, 140, 95, 60].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, now + i * 0.065);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f * 0.5), now + i * 0.065 + 0.22);
      g.gain.setValueAtTime(0.0001, now + i * 0.065);
      g.gain.exponentialRampToValueAtTime(0.08, now + i * 0.065 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.065 + 0.22);
      o.connect(g).connect(dest);
      o.start(now + i * 0.065);
      o.stop(now + i * 0.065 + 0.26);
    });
    // Noise explosion
    {
      const buf = this.shortNoise(ctx, 0.35);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.37);
    }
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

  // ── NEW SFX ────────────────────────────────────────────────────

  /** Metallic deflection hit — shield blocks damage. */
  shieldAbsorb(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Metallic noise clang
    {
      const buf = this.shortNoise(ctx, 0.06);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.value = 2200;
      filter.Q.value = 3;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.15, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.08);
    }
    // Long metallic ring decay
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(380, now + 0.02);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.1, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.47);
    }
  }

  /** Descending "whomp" — combo chain expired. */
  comboDrop(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Sub-bass pitch slide down
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.28);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.3);
    }
    // Low noise whomp
    {
      const buf = this.shortNoise(ctx, 0.22);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(60, now + 0.22);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.24);
    }
  }

  /** Bright ping/chime — hit a perfect anchor. */
  perfectAnchor(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    [880, 1320, 1760].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const t = now + i * 0.012;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07 - i * 0.016, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + 0.52);
    });
  }

  /** Subtle UI hover tick. */
  buttonHover(): void {
    if (!this.canPlay('btnHover', 60)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1600;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.018, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    osc.connect(g).connect(dest);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  /** UI button click. */
  buttonClick(): void {
    if (!this.canPlay('btn', 60)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.04);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.04, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.connect(g).connect(dest);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Armour clank — shield pickup collected. */
  shieldPickup(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Metallic clang burst
    {
      const buf = this.shortNoise(ctx, 0.08);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 2;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.1);
    }
    // Body ring
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 330;
      g.gain.setValueAtTime(0.0001, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.07, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(g).connect(dest);
      osc.start(now + 0.03);
      osc.stop(now + 0.3);
    }
  }

  /** Electronic trill — magnet pickup collected. */
  magnetPickup(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    [440, 554, 659, 880, 1108].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      const t = now + i * 0.04;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.04, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + 0.05);
    });
  }

  /** Dreamy pitch-bend glide down — slow-lava pickup collected. */
  slowPickup(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Main glide
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.45);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.47);
    }
    // Upper harmonic glide
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.45);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.47);
    }
  }

  /** Low rumble + crack — hook hits an unstable platform. */
  unstableTrigger(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Low rumble
    {
      const buf = this.shortNoise(ctx, 0.15);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.value = 120;
      filter.Q.value = 1.5;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.1, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.17);
    }
    // Crack transient
    {
      const buf = this.shortNoise(ctx, 0.04);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'highpass';
      filter.frequency.value = 2000;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.07, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.05);
    }
  }

  /** Shatter/break sound — unstable platform crumbles away. */
  unstableCrumble(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Cascading noise sweep
    {
      const buf = this.shortNoise(ctx, 0.3);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2000, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
      filter.Q.value = 1;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.13, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.32);
    }
    // Debris tones
    [220, 160, 110].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.04;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  /** Mechanical whirr — rope reeling in. */
  ropeReelIn(): void {
    if (!this.canPlay('reelIn', 80)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const buf = this.shortNoise(ctx, 0.1);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.value = 1600;
    filter.Q.value = 4;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    src.connect(filter).connect(g).connect(dest);
    src.start(now);
    src.stop(now + 0.12);
  }

  /** Slack creak — rope reeling out. */
  ropeReelOut(): void {
    if (!this.canPlay('reelOut', 120)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(240, now + 0.1);
    osc.frequency.linearRampToValueAtTime(280, now + 0.15);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.025, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(g).connect(dest);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  /** 2-note ascending fanfare — new personal best. */
  personalBest(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    [523.25, 783.99].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.16);
      g.gain.setValueAtTime(0.0001, now + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.09, now + i * 0.16 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.3);
      osc.connect(g).connect(dest);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.32);
    });
  }

  // ── Looped ambient sounds ──────────────────────────────────────

  /**
   * Update lava warning loop. `intensity` 0..1 — pass 0 to stop.
   * Lazily starts a looped low-rumble noise; updates gain each call.
   */
  lavaWarning(intensity: number): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest || intensity <= 0) {
      this.stopLavaLoop();
      return;
    }
    if (!this.lavaLoop) {
      const buf = this.getNoiseBuf(ctx);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      filter.type = 'bandpass';
      filter.frequency.value = 80;
      filter.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      src.connect(filter).connect(g).connect(dest);
      src.start();
      this.lavaLoop = { src, gain: g };
    }
    this.lavaLoop.gain.gain.setTargetAtTime(intensity * 0.065, ctx.currentTime, 0.1);
  }

  private stopLavaLoop(): void {
    if (!this.lavaLoop) return;
    const ctx = this.engine.ctx;
    const loop = this.lavaLoop;
    this.lavaLoop = null;
    if (ctx) loop.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    setTimeout(() => {
      try { loop.src.stop(); } catch { /* already stopped */ }
      try { loop.src.disconnect(); } catch { /* already disconnected */ }
    }, 200);
  }

  /**
   * Update wind altitude loop. `gain` 0..1 — pass 0 to stop.
   * High-pass filtered noise whose volume scales with altitude.
   */
  windAltitude(gain: number): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest || gain <= 0) {
      this.stopWindLoop();
      return;
    }
    if (!this.windLoop) {
      const buf = this.getNoiseBuf(ctx);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.5;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      src.connect(filter).connect(g).connect(dest);
      src.start();
      this.windLoop = { src, gain: g };
    }
    this.windLoop.gain.gain.setTargetAtTime(gain * 0.055, ctx.currentTime, 0.3);
  }

  private stopWindLoop(): void {
    if (!this.windLoop) return;
    const ctx = this.engine.ctx;
    const loop = this.windLoop;
    this.windLoop = null;
    if (ctx) loop.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    setTimeout(() => {
      try { loop.src.stop(); } catch { /* already stopped */ }
      try { loop.src.disconnect(); } catch { /* already disconnected */ }
    }, 500);
  }

  /** Stop all looped ambient sounds — call when a run ends. */
  stopLooped(): void {
    this.stopLavaLoop();
    this.stopWindLoop();
  }

  // ── Race / competition SFX ─────────────────────────────────────

  /** 3 beeps + GO! — played at the start of a bot race. */
  raceStartCountdown(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Three countdown beeps
    [0, 1, 2].forEach((i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 440;
      const t = now + i;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + 0.14);
    });
    // "GO!" — higher pitched, longer
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 880;
      const t = now + 3;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + 0.37);
    }
  }

  /** Minor chord tension sting — a bot overtakes the player. */
  raceBotOvertake(): void {
    if (!this.canPlay('botOvertake', 1500)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    [440, 523, 622].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const t = now + i * 0.02;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  /** Crowd cheer — player crosses the finish line. */
  finishLineCross(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Rising noise burst (crowd)
    {
      const buf = this.shortNoise(ctx, 0.6);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.3);
      filter.Q.value = 0.5;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.62);
    }
    // Rising fanfare notes
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const t = now + i * 0.07;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + 0.27);
    });
  }

  /** 3-note C-E-G fanfare — gold medal. */
  medalGold(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      [1, 2].forEach((harm) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f * harm;
        const t = now + i * 0.14;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06 / harm, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
        osc.connect(g).connect(dest);
        osc.start(t);
        osc.stop(t + 0.44);
      });
    });
  }

  /** 2-note C-E fanfare — silver medal. */
  medalSilver(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    [523.25, 659.25].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const t = now + i * 0.14;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + 0.37);
    });
  }

  /** 1-note fanfare with resonant decay — bronze medal. */
  medalBronze(): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 523.25;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(g).connect(dest);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  /** Sharp clock tick — final seconds of ComboRun/TimeAttack. */
  countdownTick(): void {
    if (!this.canPlay('cntTick', 800)) return;
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    // Sharp transient
    {
      const buf = this.shortNoise(ctx, 0.018);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      filter.type = 'highpass';
      filter.frequency.value = 3000;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.1, now + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
      src.connect(filter).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.02);
    }
    // Tone body
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1200;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.04, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  }
}

