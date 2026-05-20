import type { AudioEngine } from './AudioEngine';

export type AudioAssetKey = 'music:above-the-steel' | 'sfx:whip';

// Vite copies everything under public/ verbatim. import.meta.env.BASE_URL is
// the configured base (`./` here), so the resolved URL stays relative to the
// document root — which is what we need for the CrazyGames iframe host.
const BASE = import.meta.env.BASE_URL;
const ASSET_URLS: Record<AudioAssetKey, string> = {
  'music:above-the-steel': `${BASE}audio/above-the-steel.mp3`,
  'sfx:whip': `${BASE}audio/whip.mp3`,
};

export class AudioAssets {
  private engine: AudioEngine;
  private buffers = new Map<AudioAssetKey, AudioBuffer>();
  private pending = new Map<AudioAssetKey, Promise<AudioBuffer | null>>();

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  /** Returns the decoded buffer immediately if already loaded, otherwise null. */
  get(key: AudioAssetKey): AudioBuffer | null {
    return this.buffers.get(key) ?? null;
  }

  /**
   * Kicks off (or returns) an in-flight load. Resolves with the buffer or null
   * if the file is unreachable / the AudioContext isn't ready yet. Safe to call
   * repeatedly — the same Promise is reused until it settles.
   */
  async load(key: AudioAssetKey): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(key);
    if (cached) return cached;
    const inflight = this.pending.get(key);
    if (inflight) return inflight;
    const ctx = this.engine.ctx;
    if (!ctx) return null;
    const url = ASSET_URLS[key];
    const task = (async (): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        this.buffers.set(key, buf);
        return buf;
      } catch (err) {
        console.warn(`AudioAssets: failed to load ${key} (${url})`, err);
        return null;
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, task);
    return task;
  }

  /** Fire-and-forget warmup for a list of assets. */
  preload(keys: AudioAssetKey[]): void {
    for (const k of keys) void this.load(k);
  }
}
