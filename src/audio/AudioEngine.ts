type W = Window & typeof globalThis;
const w = globalThis as W;

export type AudioBus = 'master' | 'music' | 'sfx';

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  enabled: boolean = true;
  musicEnabled: boolean = true;
  sfxEnabled: boolean = true;
  unlocked: boolean = false;

  /** Initialise on user gesture so iOS allows audio playback. */
  unlock(): void {
    if (this.unlocked) return;
    const Ctor: typeof AudioContext | undefined =
      w.AudioContext ?? (w.webkitAudioContext as typeof AudioContext | undefined);
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      const master = this.ctx.createGain();
      master.gain.value = 0.65;
      master.connect(this.ctx.destination);
      const music = this.ctx.createGain();
      music.gain.value = 0.5;
      music.connect(master);
      const sfx = this.ctx.createGain();
      sfx.gain.value = 0.9;
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
    if (this.master) this.master.gain.value = enabled && this.enabled ? 0.65 : 0;
    if (this.musicBus) this.musicBus.gain.value = this.musicEnabled ? 0.5 : 0;
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxEnabled ? 0.9 : 0;
  }

  setVolume(bus: AudioBus, value: number): void {
    const v = Math.max(0, Math.min(1, value));
    if (bus === 'master' && this.master) this.master.gain.value = v;
    if (bus === 'music' && this.musicBus) this.musicBus.gain.value = v;
    if (bus === 'sfx' && this.sfxBus) this.sfxBus.gain.value = v;
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
