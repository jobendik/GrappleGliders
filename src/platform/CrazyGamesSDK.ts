import type { CrazyGamesSDK as SDK } from '../types/global';

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const SDK_LOAD_TIMEOUT_MS = 3000;
// Standalone (itch, GitHub Pages, direct hosting) — the SDK hangs ~10s on the
// parent-frame handshake before resolving as "disabled"; bail fast so boot
// isn't blocked.
const SDK_INIT_TIMEOUT_STANDALONE_MS = 2500;
// Iframe (CrazyGames portal, official embeds) — the handshake is real and
// needs time. Too short a timeout silently disables every subsequent SDK
// call, including gameplayStart, which fails CG's "First gameplay start" QA.
const SDK_INIT_TIMEOUT_IFRAME_MS = 15_000;
const HAPPYTIME_COOLDOWN_MS = 60_000;

export type AdType = 'midgame' | 'rewarded';

export interface CrazyAdapter {
  cloudGet(key: string): Promise<string | null>;
  cloudSet(key: string, value: string): Promise<void>;
}

export type CrazyEnvironment = 'local' | 'crazygames' | 'disabled' | 'unavailable';

function isLikelyHostedInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function shouldLog(): boolean {
  try {
    if (import.meta.env?.DEV) return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('devCrazySDK') === '1';
  } catch {
    return false;
  }
}

/**
 * CrazyGames SDK v3 wrapper.
 *
 * Lifecycle contract (per https://docs.crazygames.com/sdk/game/):
 *   - `init()` must be awaited before any other call. Wrapper queues pre-init
 *     calls and replays them in order once init resolves.
 *   - `loadingStart()` brackets a loading phase; pair with `loadingStop()`.
 *   - `gameplayStart()` is fired when the player enters actual gameplay
 *     (NOT on menu/loading/settings/pause). `gameplayStop()` on every break.
 *   - The "initial download size" metric is measured from page load until the
 *     first `gameplayStart()`. The menu must stay outside gameplay, but it
 *     must also be cheap to render so this metric stays small.
 *
 * Boot guarantees:
 *   - `initPromise` always resolves, never rejects.
 *   - On localhost / GitHub Pages / any non-CG host: `init()` resolves with
 *     `available=false` within the standalone timeout and every method becomes
 *     a safe no-op.
 *   - Pre-init `gameplayStart`/`gameplayStop`/`loadingStart`/`loadingStop`
 *     calls are queued and flushed in order after init.
 */
export class CrazyGamesPlatform {
  private sdk: SDK | null = null;
  private loadAttempted = false;
  private lastAdTime = 0;
  private lastHappytime = 0;
  private gameplayActive = false;
  private loadingActive = false;
  private adsAvailable = true;
  private readonly preInitQueue: Array<'loadingStart' | 'loadingStop' | 'gameplayStart' | 'gameplayStop'> = [];
  private readonly logEnabled = shouldLog();
  private environmentDetected: CrazyEnvironment = 'unavailable';
  /** Resolves after `init()` settles, regardless of outcome. Never rejects. */
  readonly initPromise: Promise<void>;
  private resolveInit: () => void = () => undefined;
  available = false;

  constructor() {
    this.initPromise = new Promise<void>((resolve) => {
      this.resolveInit = resolve;
    });
  }

  get environment(): CrazyEnvironment {
    return this.environmentDetected;
  }

  async init(): Promise<void> {
    if (this.loadAttempted) return this.initPromise;
    this.loadAttempted = true;
    this.log('init started');
    try {
      await this.loadScript();
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) {
        this.environmentDetected = 'unavailable';
        this.log('SDK script unreachable — environment: unavailable');
        return;
      }
      const initTimeoutMs = isLikelyHostedInIframe()
        ? SDK_INIT_TIMEOUT_IFRAME_MS
        : SDK_INIT_TIMEOUT_STANDALONE_MS;
      await Promise.race([
        sdk.init(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('SDK init timeout')), initTimeoutMs),
        ),
      ]);
      // Probe getters to detect the "disabled" environment, in which `game` /
      // `data` / `ad` are throwing getters.
      try {
        void sdk.game;
        void sdk.data;
      } catch {
        this.environmentDetected = 'disabled';
        this.log('SDK reports disabled — environment: disabled');
        return;
      }
      this.sdk = sdk;
      this.available = true;
      this.environmentDetected = this.detectEnvironment(sdk);
      this.log(`init complete — environment: ${this.environmentDetected}`);
      this.flushQueue();
    } catch (err) {
      // SDK unavailable (CDN blocked, init timed out, or environment disabled).
      this.available = false;
      this.environmentDetected = 'unavailable';
      this.log(`init failed (${(err as Error)?.message ?? 'unknown'}) — environment: unavailable`);
    } finally {
      this.resolveInit();
    }
    return undefined;
  }

  private detectEnvironment(sdk: SDK): CrazyEnvironment {
    try {
      const env = sdk.getEnvironment?.();
      if (env === 'local' || env === 'crazygames' || env === 'disabled') return env;
    } catch {
      // The SDK throws on env getter access in some "disabled" builds — fall
      // through to heuristic.
    }
    return isLikelyHostedInIframe() ? 'crazygames' : 'local';
  }

  /**
   * Pre-init queueing: capture loading/gameplay events that fire before the
   * SDK is ready, and replay them in order once it is. Without this, a player
   * who starts (and finishes) a run faster than the iframe handshake would
   * never produce a `gameplayStart` event in the SDK log.
   */
  private flushQueue(): void {
    if (!this.sdk) return;
    for (const event of this.preInitQueue) {
      switch (event) {
        case 'loadingStart':
          this.safeCall(() => this.sdk!.game.loadingStart?.());
          break;
        case 'loadingStop':
          this.safeCall(() => this.sdk!.game.loadingStop?.());
          break;
        case 'gameplayStart':
          this.safeCall(() => this.sdk!.game.gameplayStart?.());
          break;
        case 'gameplayStop':
          this.safeCall(() => this.sdk!.game.gameplayStop?.());
          break;
      }
    }
    this.preInitQueue.length = 0;
  }

  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.CrazyGames?.SDK) {
        resolve();
        return;
      }
      const existing =
        document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`) ??
        document.querySelector<HTMLScriptElement>('script[data-cg-sdk]');
      if (existing) {
        if (existing.dataset.cgLoaded === '1') {
          resolve();
          return;
        }
        existing.addEventListener(
          'load',
          () => {
            existing.dataset.cgLoaded = '1';
            resolve();
          },
          { once: true },
        );
        existing.addEventListener('error', () => reject(new Error('SDK failed')), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.dataset.cgSdk = '1';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('SDK load error'));
      const timeout = setTimeout(() => reject(new Error('SDK timeout')), SDK_LOAD_TIMEOUT_MS);
      s.addEventListener('load', () => clearTimeout(timeout), { once: true });
      document.head.appendChild(s);
    });
  }

  private safeCall(fn: () => void): void {
    try {
      fn();
    } catch {
      // Disabled SDK throws synchronously from game/data/ad getters. Drop the
      // reference so we stop hitting it.
      this.sdk = null;
      this.available = false;
    }
  }

  /**
   * Bracket a real loading phase. Idempotent: a second call without an
   * intervening `loadingStop` is a no-op. Safe to call before init — the
   * event is queued and flushed once init resolves.
   */
  loadingStart(): void {
    if (this.loadingActive) return;
    this.loadingActive = true;
    this.log('loadingStart');
    if (!this.sdk) {
      this.preInitQueue.push('loadingStart');
      return;
    }
    this.safeCall(() => this.sdk!.game.loadingStart?.());
  }

  loadingStop(): void {
    if (!this.loadingActive) return;
    this.loadingActive = false;
    this.log('loadingStop');
    if (!this.sdk) {
      this.preInitQueue.push('loadingStop');
      return;
    }
    this.safeCall(() => this.sdk!.game.loadingStop?.());
  }

  gameplayStart(): void {
    if (this.gameplayActive) return;
    this.gameplayActive = true;
    this.log('gameplayStart');
    if (!this.sdk) {
      this.preInitQueue.push('gameplayStart');
      return;
    }
    this.safeCall(() => this.sdk!.game.gameplayStart?.());
  }

  gameplayStop(): void {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    this.log('gameplayStop');
    if (!this.sdk) {
      this.preInitQueue.push('gameplayStop');
      return;
    }
    this.safeCall(() => this.sdk!.game.gameplayStop?.());
  }

  /** Signal a "delightful moment" — boosts placement in CrazyGames' recommendation algo. */
  happytime(): void {
    if (!this.sdk) return;
    const now = performance.now();
    if (now - this.lastHappytime < HAPPYTIME_COOLDOWN_MS) return;
    this.lastHappytime = now;
    this.safeCall(() => this.sdk!.game.happytime?.());
  }

  requestAd(
    type: AdType,
    cooldownSeconds: number = 240,
  ): Promise<{ rewarded: boolean; played: boolean }> {
    return new Promise((resolve) => {
      const now = performance.now() / 1000;
      if (type === 'midgame' && now - this.lastAdTime < cooldownSeconds) {
        resolve({ rewarded: false, played: false });
        return;
      }
      if (!this.sdk) {
        resolve({ rewarded: false, played: false });
        return;
      }
      if (!this.adsAvailable) {
        resolve({ rewarded: false, played: false });
        return;
      }
      let rewarded = false;
      let settled = false;
      const finish = (result: { rewarded: boolean; played: boolean }): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };
      const timeout = setTimeout(() => finish({ rewarded: false, played: false }), 8000);
      try {
        const ad = this.sdk.ad;
        if (!ad?.requestAd) {
          this.adsAvailable = false;
          finish({ rewarded: false, played: false });
          return;
        }
        ad.requestAd(type, {
          adStarted: () => undefined,
          adFinished: () => {
            this.lastAdTime = now;
            if (type === 'rewarded') rewarded = true;
            finish({ rewarded, played: true });
          },
          adError: () => finish({ rewarded: false, played: false }),
        });
      } catch {
        // Ads may be disabled in Basic Launch / QA while the rest of the SDK
        // remains valid. Keep game/data/user calls alive.
        this.adsAvailable = false;
        finish({ rewarded: false, played: false });
      }
    });
  }

  cloudAdapter(): CrazyAdapter | null {
    if (!this.sdk) return null;
    let data: SDK['data'];
    try {
      data = this.sdk.data;
      if (!data.getItem || !data.setItem) return null;
    } catch {
      this.sdk = null;
      this.available = false;
      return null;
    }
    const disable = (): void => {
      this.sdk = null;
      this.available = false;
    };
    return {
      cloudGet: (key) => {
        try {
          return data.getItem!(key);
        } catch (err) {
          disable();
          return Promise.reject(err);
        }
      },
      cloudSet: (key, value) => {
        try {
          return data.setItem!(key, value);
        } catch (err) {
          disable();
          return Promise.reject(err);
        }
      },
    };
  }

  /** Resolve the player's CrazyGames username, or null if no account / not available. */
  async getUsername(): Promise<string | null> {
    if (!this.sdk) return null;
    try {
      const user = this.sdk.user;
      if (!user?.getUser) return null;
      const accountOk = user.isUserAccountAvailable ? await user.isUserAccountAvailable() : true;
      if (!accountOk) return null;
      const profile = await user.getUser();
      const name = profile?.username?.trim();
      return name && name.length > 0 ? name : null;
    } catch {
      this.sdk = null;
      this.available = false;
      return null;
    }
  }

  private log(message: string): void {
    if (!this.logEnabled) return;
    // eslint config allows console.warn — used here as a non-error diagnostic
    // channel since `console.log` is gated. Tagged so callers can grep.
    console.warn(`[CrazySDK] ${message}`);
  }
}
