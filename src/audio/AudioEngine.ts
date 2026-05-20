import { AudioAssets } from './AudioAssets';

type W = Window & typeof globalThis;
const w = globalThis as W;

export type AudioBus = 'master' | 'music' | 'sfx';

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  assets: AudioAssets;
  enabled: boolean = true;
  musicEnabled: boolean = true;
  sfxEnabled: boolean = true;
  unlocked: boolean = false;
  /** Last user-set music volume (0..1). Restored when re-enabling. */
  private musicVolume = 0.5;
  /** Last user-set sfx volume (0..1). Restored when re-enabling. */
  private sfxVolume = 0.9;
  private masterVolume = 0.65;

  constructor() {
    this.assets = new AudioAssets(this);
  }

  /** Initialise on user gesture so iOS allows audio playback. */
  unlock(): void {
    if (this.unlocked) return;
    const Ctor: typeof AudioContext | undefined =
      w.AudioContext ?? (w.webkitAudioContext as typeof AudioContext | undefined);
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      const master = this.ctx.createGain();
      master.gain.value = this.enabled ? this.masterVolume : 0;
      master.connect(this.ctx.destination);
      const music = this.ctx.createGain();
      music.gain.value = this.musicEnabled ? this.musicVolume : 0;
      music.connect(master);
      const sfx = this.ctx.createGain();
      sfx.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
      sfx.connect(master);
      this.master = master;
      this.musicBus = music;
      this.sfxBus = sfx;
      this.unlocked = true;
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (err) {
      console.warn('AudioEngine init failed', err);
    }
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(bus: AudioBus, enabled: boolean): void {
    if (bus === 'master') this.enabled = enabled;
    if (bus === 'music') this.musicEnabled = enabled;
    if (bus === 'sfx') this.sfxEnabled = enabled;
    if (this.master) this.master.gain.value = this.enabled ? this.masterVolume : 0;
    if (this.musicBus) this.musicBus.gain.value = this.musicEnabled ? this.musicVolume : 0;
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
  }

  setVolume(bus: AudioBus, value: number): void {
    const v = Math.max(0, Math.min(1, value));
    if (bus === 'master') {
      this.masterVolume = v;
      if (this.master) this.master.gain.value = this.enabled ? v : 0;
    } else if (bus === 'music') {
      this.musicVolume = v;
      if (this.musicBus) this.musicBus.gain.value = this.musicEnabled ? v : 0;
    } else if (bus === 'sfx') {
      this.sfxVolume = v;
      if (this.sfxBus) this.sfxBus.gain.value = this.sfxEnabled ? v : 0;
    }
  }

  get sfxDest(): AudioNode | null {
    return this.sfxEnabled && this.enabled ? this.sfxBus : null;
  }

  get musicDest(): AudioNode | null {
    return this.musicEnabled && this.enabled ? this.musicBus : null;
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }
}
