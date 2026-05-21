import type { AudioEngine } from './AudioEngine';

/**
 * All decoded-audio assets the game can fetch on demand. Keys split by purpose:
 *   - `music:*`  — long, lazy-loaded MP3 theme & menu loops (~2 MB each)
 *   - `sfx:*`    — short OGG Vorbis sound effects (~10-150 KB each)
 *
 * SFX are pre-warmed on first audio unlock so the very first hook-fire,
 * dash, etc. play instantly. Music loads lazily on first theme play.
 */
export type AudioAssetKey =
  // ── Music ─────────────────────────────────────────────────────
  | 'music:synthwave'
  | 'music:vaporwave'
  | 'music:cyber-noir'
  | 'music:blood-moon'
  | 'music:ice-station'
  | 'music:neon-jungle'
  | 'music:menu'
  // ── Core gameplay SFX ─────────────────────────────────────────
  | 'sfx:hook-fire'
  | 'sfx:hook-connect'
  | 'sfx:hook-release'
  | 'sfx:swing-whoosh'
  | 'sfx:dash'
  | 'sfx:near-miss'
  | 'sfx:combo'
  | 'sfx:combo-drop'
  | 'sfx:bounce'
  | 'sfx:death'
  | 'sfx:perfect-anchor'
  | 'sfx:level-up'
  | 'sfx:unlock'
  | 'sfx:trick'
  | 'sfx:spark'
  // ── Pickups & hazards ─────────────────────────────────────────
  | 'sfx:shield-absorb'
  | 'sfx:shield-pickup'
  | 'sfx:magnet-pickup'
  | 'sfx:slow-pickup'
  | 'sfx:unstable-trigger'
  | 'sfx:unstable-crumble'
  | 'sfx:rope-reel-in'
  | 'sfx:rope-reel-out'
  // ── UI ────────────────────────────────────────────────────────
  | 'sfx:button-click'
  | 'sfx:button-hover'
  // ── Race / event ──────────────────────────────────────────────
  | 'sfx:race-start'
  | 'sfx:race-bot-overtake'
  | 'sfx:finish-line'
  | 'sfx:medal-gold'
  | 'sfx:medal-silver'
  | 'sfx:medal-bronze'
  | 'sfx:personal-best'
  | 'sfx:countdown-tick'
  | 'sfx:last-chance'
  | 'sfx:boss-alert'
  // ── Looped ambient (one buffer, played with src.loop=true) ────
  | 'sfx:lava-roar'
  | 'sfx:lava-warning'
  | 'sfx:wind-altitude';

const BASE = import.meta.env.BASE_URL;
const ASSET_URLS: Record<AudioAssetKey, string> = {
  // Music — MP3 stays the only MP3 format in the build.
  'music:synthwave': `${BASE}audio/above-the-steel.mp3`,
  'music:vaporwave': `${BASE}audio/Glass_and_Grime.mp3`,
  'music:cyber-noir': `${BASE}audio/rain-on-chrome.mp3`,
  'music:blood-moon': `${BASE}audio/Cathedral_of_Teeth.mp3`,
  'music:ice-station': `${BASE}audio/Above_the_Whiteout.mp3`,
  'music:neon-jungle': `${BASE}audio/Acid_Bloom.mp3`,
  'music:menu': `${BASE}audio/neon-lobby.mp3`,
  // SFX — OGG Vorbis (~q4 / 128 kbps), supported by every modern browser.
  'sfx:hook-fire': `${BASE}audio/sfx/hook-fire.ogg`,
  'sfx:hook-connect': `${BASE}audio/sfx/hook-connect.ogg`,
  'sfx:hook-release': `${BASE}audio/sfx/hook-release.ogg`,
  'sfx:swing-whoosh': `${BASE}audio/sfx/swing-whoosh.ogg`,
  'sfx:dash': `${BASE}audio/sfx/dash.ogg`,
  'sfx:near-miss': `${BASE}audio/sfx/near-miss.ogg`,
  'sfx:combo': `${BASE}audio/sfx/combo.ogg`,
  'sfx:combo-drop': `${BASE}audio/sfx/combo-drop.ogg`,
  'sfx:bounce': `${BASE}audio/sfx/bounce.ogg`,
  'sfx:death': `${BASE}audio/sfx/death.ogg`,
  'sfx:perfect-anchor': `${BASE}audio/sfx/perfect-anchor.ogg`,
  'sfx:level-up': `${BASE}audio/sfx/level-up.ogg`,
  'sfx:unlock': `${BASE}audio/sfx/unlock.ogg`,
  'sfx:trick': `${BASE}audio/sfx/trick.ogg`,
  'sfx:spark': `${BASE}audio/sfx/spark.ogg`,
  'sfx:shield-absorb': `${BASE}audio/sfx/shield-absorb.ogg`,
  'sfx:shield-pickup': `${BASE}audio/sfx/shield-pickup.ogg`,
  'sfx:magnet-pickup': `${BASE}audio/sfx/magnet-pickup.ogg`,
  'sfx:slow-pickup': `${BASE}audio/sfx/slow-pickup.ogg`,
  'sfx:unstable-trigger': `${BASE}audio/sfx/unstable-trigger.ogg`,
  'sfx:unstable-crumble': `${BASE}audio/sfx/unstable-crumble.ogg`,
  'sfx:rope-reel-in': `${BASE}audio/sfx/rope-reel-in.ogg`,
  'sfx:rope-reel-out': `${BASE}audio/sfx/rope-reel-out.ogg`,
  'sfx:button-click': `${BASE}audio/sfx/button-click.ogg`,
  'sfx:button-hover': `${BASE}audio/sfx/button-hover.ogg`,
  'sfx:race-start': `${BASE}audio/sfx/race-start.ogg`,
  'sfx:race-bot-overtake': `${BASE}audio/sfx/race-bot-overtake.ogg`,
  'sfx:finish-line': `${BASE}audio/sfx/finish-line.ogg`,
  'sfx:medal-gold': `${BASE}audio/sfx/medal-gold.ogg`,
  'sfx:medal-silver': `${BASE}audio/sfx/medal-silver.ogg`,
  'sfx:medal-bronze': `${BASE}audio/sfx/medal-bronze.ogg`,
  'sfx:personal-best': `${BASE}audio/sfx/personal-best.ogg`,
  'sfx:countdown-tick': `${BASE}audio/sfx/countdown-tick.ogg`,
  'sfx:last-chance': `${BASE}audio/sfx/last-chance.ogg`,
  'sfx:boss-alert': `${BASE}audio/sfx/boss-alert.ogg`,
  'sfx:lava-roar': `${BASE}audio/sfx/lava-roar.ogg`,
  'sfx:lava-warning': `${BASE}audio/sfx/lava-warning.ogg`,
  'sfx:wind-altitude': `${BASE}audio/sfx/wind-altitude.ogg`,
};

/**
 * Warmed automatically on audio unlock — total ~1.8 MB so the player never
 * hears a delay on the first hook-fire, first dash, first pickup, etc.
 * Music is loaded lazily on first theme play (~2 MB per theme).
 */
const PRELOAD_ON_UNLOCK: readonly AudioAssetKey[] = [
  'music:menu',
  // All SFX — small enough to pre-warm in one pass.
  'sfx:hook-fire',
  'sfx:hook-connect',
  'sfx:hook-release',
  'sfx:swing-whoosh',
  'sfx:dash',
  'sfx:near-miss',
  'sfx:combo',
  'sfx:combo-drop',
  'sfx:bounce',
  'sfx:death',
  'sfx:perfect-anchor',
  'sfx:level-up',
  'sfx:unlock',
  'sfx:trick',
  'sfx:spark',
  'sfx:shield-absorb',
  'sfx:shield-pickup',
  'sfx:magnet-pickup',
  'sfx:slow-pickup',
  'sfx:unstable-trigger',
  'sfx:unstable-crumble',
  'sfx:rope-reel-in',
  'sfx:rope-reel-out',
  'sfx:button-click',
  'sfx:button-hover',
  'sfx:race-start',
  'sfx:race-bot-overtake',
  'sfx:finish-line',
  'sfx:medal-gold',
  'sfx:medal-silver',
  'sfx:medal-bronze',
  'sfx:personal-best',
  'sfx:countdown-tick',
  'sfx:last-chance',
  'sfx:boss-alert',
  'sfx:lava-roar',
  'sfx:lava-warning',
  'sfx:wind-altitude',
];

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
  preload(keys: readonly AudioAssetKey[]): void {
    for (const k of keys) void this.load(k);
  }

  /** Warm all SFX + the menu loop — called on audio unlock. */
  preloadDefaults(): void {
    this.preload(PRELOAD_ON_UNLOCK);
  }
}
