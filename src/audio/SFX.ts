import type { AudioEngine } from './AudioEngine';
import type { AudioAssetKey } from './AudioAssets';

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

/** Options for a one-shot file playback. */
interface PlayOpts {
  /** Output gain 0..1. Default 1. */
  gain?: number;
  /** ±factor randomized into playbackRate. 0.08 = ±8% pitch variance. */
  pitchJitter?: number;
  /** ±spread for random stereo pan, 0..1. UI sounds use 0 (centered). */
  pan?: number;
  /** Minimum ms between successive triggers of this key. */
  throttleMs?: number;
  /** Throttle tag override — share throttle across keys, or pass own. */
  throttleTag?: string;
  /** Fixed playback rate (overrides pitchJitter). 1.0 = native pitch. */
  rate?: number;
}

/**
 * Real-file sound effects player. Every method here plays a sample loaded
 * by `AudioAssets`. Files are pre-warmed on audio unlock so the first
 * trigger is instant; if a buffer isn't loaded yet the call no-ops cleanly
 * and kicks off a background fetch for next time.
 *
 * Per-shot pitch jitter (playbackRate) and stereo pan jitter prevent
 * repetition fatigue when the same sound fires rapidly — even though
 * we're playing back the same recorded sample, each instance is subtly
 * different.
 */
export class SFX {
  private lastTrigger: Record<string, number> = {};
  // Persistent looped sounds — one slot per looped key.
  private loops = new Map<AudioAssetKey, LoopedSound>();

  constructor(private engine: AudioEngine) {}

  private canPlay(tag: string, minGapMs = 30): boolean {
    const now = performance.now();
    if (now - (this.lastTrigger[tag] ?? 0) < minGapMs) return false;
    this.lastTrigger[tag] = now;
    return true;
  }

  // ── Core playback helper ───────────────────────────────────────

  /**
   * Play a pre-loaded sample once through the SFX bus. Routes through
   * an optional StereoPanner for per-shot positional jitter and an
   * optional playbackRate for pitch variation — together these keep
   * repeated triggers from feeling robotic.
   *
   * If the buffer isn't loaded yet, kicks off a background fetch and
   * returns silently. The next trigger should hit cached.
   */
  private play(key: AudioAssetKey, opts: PlayOpts = {}): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const throttle = opts.throttleMs ?? 0;
    if (throttle > 0) {
      const tag = opts.throttleTag ?? key;
      if (!this.canPlay(tag, throttle)) return;
    }
    const buffer = this.engine.assets.get(key);
    if (!buffer) {
      void this.engine.assets.load(key);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    if (opts.rate != null) {
      src.playbackRate.value = opts.rate;
    } else if (opts.pitchJitter && opts.pitchJitter > 0) {
      const j = opts.pitchJitter;
      src.playbackRate.value = 1 + (Math.random() * 2 - 1) * j;
    }
    const gain = ctx.createGain();
    gain.gain.value = opts.gain ?? 1;
    const pan = opts.pan ?? 0;
    if (pan > 0) {
      const panNode = ctx.createStereoPanner();
      panNode.pan.value = (Math.random() * 2 - 1) * pan;
      src.connect(gain).connect(panNode).connect(dest);
    } else {
      src.connect(gain).connect(dest);
    }
    src.start();
  }

  /**
   * Update a looped ambient sound. Pass intensity 0..1 — the loop is
   * started lazily on first non-zero call and gracefully stopped when
   * intensity drops to (effectively) zero. Gain ramps smoothly so
   * callers can spam this every frame without artifacts.
   */
  private setLoop(
    key: AudioAssetKey,
    intensity: number,
    opts: { maxGain: number; smoothing?: number },
  ): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfxDest;
    if (!ctx || !dest) return;
    const target = Math.max(0, Math.min(1, intensity));
    const existing = this.loops.get(key);
    if (target <= 0.001) {
      if (existing) {
        existing.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        const stale = existing;
        this.loops.delete(key);
        setTimeout(() => {
          try { stale.src.stop(); } catch { /* already stopped */ }
          try { stale.src.disconnect(); } catch { /* already disconnected */ }
        }, 350);
      }
      return;
    }
    if (!existing) {
      const buffer = this.engine.assets.get(key);
      if (!buffer) {
        void this.engine.assets.load(key);
        return;
      }
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buffer;
      src.loop = true;
      gain.gain.value = 0;
      src.connect(gain).connect(dest);
      src.start();
      this.loops.set(key, { src, gain });
    }
    const loop = this.loops.get(key);
    if (!loop) return;
    const smoothing = opts.smoothing ?? 0.18;
    loop.gain.gain.setTargetAtTime(target * opts.maxGain, ctx.currentTime, smoothing);
  }

  /** Stop a specific looped sound with a smooth fade. */
  private stopLoop(key: AudioAssetKey): void {
    this.setLoop(key, 0, { maxGain: 1 });
  }

  // ── Generic blip (parametric for legacy spark call) ────────────

  /**
   * Generic short SFX. Originally a procedural blip — now plays the
   * `sfx:spark` sample. The `opts.gain` is honored; other procedural
   * parameters (freq/duration/type/slide) are decorative no-ops kept
   * for call-site compatibility.
   */
  blip(tag: string, opts: BlipOpts = {}): void {
    this.play('sfx:spark', {
      gain: opts.gain ?? 0.5,
      pitchJitter: 0.12,
      pan: 0.15,
      throttleMs: 24,
      throttleTag: tag,
    });
  }

  // ── Core gameplay SFX ─────────────────────────────────────────

  hookFire(): void {
    this.play('sfx:hook-fire', { gain: 0.75, pitchJitter: 0.06, pan: 0.25, throttleMs: 60 });
  }

  hookConnect(distance: number): void {
    // Pitch scales with distance — closer hits feel snappier, far hits deeper.
    const t = Math.max(0, Math.min(1, 1 - distance / 1500));
    this.play('sfx:hook-connect', {
      gain: 0.85,
      rate: 0.85 + t * 0.3 + (Math.random() - 0.5) * 0.04,
      pan: 0.3,
      throttleMs: 30,
    });
  }

  hookRelease(): void {
    this.play('sfx:hook-release', { gain: 0.5, pitchJitter: 0.08, pan: 0.2 });
  }

  swingWhoosh(velocity: number): void {
    // Volume + pitch both scale with swing speed.
    const v = Math.max(0, Math.min(1, velocity / 40));
    this.play('sfx:swing-whoosh', {
      gain: 0.35 + v * 0.4,
      rate: 0.9 + v * 0.35 + (Math.random() - 0.5) * 0.06,
      pan: 0.5,
      throttleMs: 110,
    });
  }

  dash(): void {
    this.play('sfx:dash', { gain: 0.85, pitchJitter: 0.08, pan: 0.35, throttleMs: 80 });
  }

  nearMiss(): void {
    this.play('sfx:near-miss', { gain: 0.45, pitchJitter: 0.1, pan: 0.45, throttleMs: 120 });
  }

  combo(level: number): void {
    // Higher combos play slightly higher-pitched for ascending excitement.
    const t = Math.min(1, level / 8);
    this.play('sfx:combo', {
      gain: 0.55 + t * 0.25,
      rate: 1.0 + t * 0.25 + (Math.random() - 0.5) * 0.05,
      pan: 0.2,
      throttleMs: 70,
    });
  }

  bounce(): void {
    this.play('sfx:bounce', { gain: 0.65, pitchJitter: 0.12, pan: 0.25, throttleMs: 40 });
  }

  death(): void {
    this.play('sfx:death', { gain: 0.9, pitchJitter: 0.04 });
  }

  perfectAnchor(): void {
    this.play('sfx:perfect-anchor', { gain: 0.7, pitchJitter: 0.04, pan: 0.15, throttleMs: 80 });
  }

  levelUp(): void {
    this.play('sfx:level-up', { gain: 0.85 });
  }

  /** Generic unlock chime — pickups, achievements, theme unlocks. */
  unlock(): void {
    this.play('sfx:unlock', { gain: 0.7 });
  }

  trick(intensity: number = 1): void {
    const i = Math.max(0.5, Math.min(2, intensity));
    this.play('sfx:trick', {
      gain: 0.55,
      rate: 0.95 + i * 0.05 + (Math.random() - 0.5) * 0.06,
      pan: 0.3,
      throttleMs: 90,
    });
  }

  // ── Pickups & hazards ─────────────────────────────────────────

  shieldAbsorb(): void {
    this.play('sfx:shield-absorb', { gain: 0.75, pitchJitter: 0.06, pan: 0.25 });
  }

  comboDrop(): void {
    this.play('sfx:combo-drop', { gain: 0.7 });
  }

  shieldPickup(): void {
    this.play('sfx:shield-pickup', { gain: 0.7, pitchJitter: 0.05, pan: 0.2 });
  }

  magnetPickup(): void {
    this.play('sfx:magnet-pickup', { gain: 0.55, pitchJitter: 0.08, pan: 0.2 });
  }

  slowPickup(): void {
    this.play('sfx:slow-pickup', { gain: 0.65, pan: 0.15 });
  }

  unstableTrigger(): void {
    this.play('sfx:unstable-trigger', { gain: 0.7, pitchJitter: 0.08, pan: 0.25 });
  }

  unstableCrumble(): void {
    this.play('sfx:unstable-crumble', { gain: 0.8, pitchJitter: 0.06, pan: 0.4 });
  }

  /**
   * Set rope reel state — looped mechanical whirr that fades in/out as the
   * player actively reels. Call every frame with the current direction:
   *   'in'   — pulling the hook in (mouse held / reel-in input)
   *   'out'  — paying rope out (reel-out input)
   *   'none' — not reeling (hook detached, or attached but idle)
   *
   * Replaces the old one-shot ropeReelIn/Out methods which overlapped
   * themselves on every frame and sounded like a stuttering loop.
   */
  setReelDirection(dir: 'in' | 'out' | 'none'): void {
    this.setLoop('sfx:rope-reel-in', dir === 'in' ? 1 : 0, { maxGain: 0.4, smoothing: 0.08 });
    this.setLoop('sfx:rope-reel-out', dir === 'out' ? 1 : 0, { maxGain: 0.35, smoothing: 0.1 });
  }

  // ── UI ────────────────────────────────────────────────────────

  /** Tactile UI hover — slight pitch jitter so successive hovers vary. */
  buttonHover(): void {
    this.play('sfx:button-hover', { gain: 0.4, pitchJitter: 0.08, throttleMs: 60 });
  }

  buttonClick(): void {
    this.play('sfx:button-click', { gain: 0.55, pitchJitter: 0.06, throttleMs: 60 });
  }

  // ── Race / event SFX ─────────────────────────────────────────

  raceStartCountdown(): void {
    this.play('sfx:race-start', { gain: 0.85 });
  }

  raceBotOvertake(): void {
    this.play('sfx:race-bot-overtake', { gain: 0.65, throttleMs: 1500 });
  }

  finishLineCross(): void {
    this.play('sfx:finish-line', { gain: 0.9 });
  }

  medalGold(): void {
    this.play('sfx:medal-gold', { gain: 0.95 });
  }

  medalSilver(): void {
    this.play('sfx:medal-silver', { gain: 0.85 });
  }

  medalBronze(): void {
    this.play('sfx:medal-bronze', { gain: 0.75 });
  }

  personalBest(): void {
    this.play('sfx:personal-best', { gain: 0.85 });
  }

  countdownTick(): void {
    this.play('sfx:countdown-tick', {
      gain: 0.7,
      pitchJitter: 0.04,
      throttleMs: 800,
    });
  }

  /** One-shot tension layer — first frame of the final-10s countdown. */
  lastChance(): void {
    this.play('sfx:last-chance', { gain: 0.65 });
  }

  /** Boss-wave alarm — danger-incoming klaxon. */
  bossAlert(): void {
    this.play('sfx:boss-alert', { gain: 0.85 });
  }

  // ── Looped ambient ────────────────────────────────────────────

  /** Update lava roar intensity 0..1. Started lazily, stopped when 0. */
  setLavaRoarIntensity(intensity: number): void {
    this.setLoop('sfx:lava-roar', intensity, { maxGain: 0.32, smoothing: 0.2 });
  }

  /** Update lava warning intensity 0..1. */
  lavaWarning(intensity: number): void {
    this.setLoop('sfx:lava-warning', intensity, { maxGain: 0.22, smoothing: 0.12 });
  }

  /** Update wind altitude gain 0..1. */
  windAltitude(gain: number): void {
    this.setLoop('sfx:wind-altitude', gain, { maxGain: 0.25, smoothing: 0.3 });
  }

  /** Tear down the lava roar loop — call when leaving a lava mode. */
  stopLavaRoar(): void {
    this.stopLoop('sfx:lava-roar');
  }

  /** Stop all looped ambient sounds — call when a run ends. */
  stopLooped(): void {
    this.stopLoop('sfx:lava-roar');
    this.stopLoop('sfx:lava-warning');
    this.stopLoop('sfx:wind-altitude');
    this.stopLoop('sfx:rope-reel-in');
    this.stopLoop('sfx:rope-reel-out');
  }
}
