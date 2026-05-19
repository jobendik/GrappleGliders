import type { CrazyGamesSDK as SDK } from '../types/global';

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const SDK_LOAD_TIMEOUT_MS = 3000;
const SDK_INIT_TIMEOUT_MS = 2500;

export type AdType = 'midgame' | 'rewarded';

export interface CrazyAdapter {
  cloudGet(key: string): Promise<string | null>;
  cloudSet(key: string, value: string): Promise<void>;
}

export class CrazyGamesPlatform {
  private sdk: SDK | null = null;
  private loadAttempted = false;
  private lastAdTime = 0;
  available = false;

  async init(): Promise<void> {
    if (this.loadAttempted) return;
    this.loadAttempted = true;
    try {
      await this.loadScript();
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      // Race init against a timeout — on non-CrazyGames domains the SDK can
      // spend ~10s waiting on a parent frame handshake before resolving as
      // "disabled". We don't want that on the boot path.
      await Promise.race([
        sdk.init(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('SDK init timeout')), SDK_INIT_TIMEOUT_MS),
        ),
      ]);
      // Probe a getter to detect the "disabled" environment, in which the SDK
      // exposes `game` / `data` / `ad` as throwing getters. If the probe
      // throws, leave `sdk` null so every wrapper call no-ops cleanly.
      try {
        void sdk.game;
        void sdk.data;
      } catch {
        return;
      }
      this.sdk = sdk;
      this.available = true;
      this.safeCall(() => sdk.game.loadingStop?.());
    } catch {
      // SDK unavailable (CDN blocked, init timed out, or environment disabled).
      this.available = false;
    }
  }

  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-cg-sdk]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
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
      // Disabled SDK throws synchronously from `game`/`data`/`ad` getters.
      // Mark unavailable so we stop hitting it.
      this.sdk = null;
      this.available = false;
    }
  }

  gameplayStart(): void {
    if (!this.sdk) return;
    this.safeCall(() => this.sdk!.game.gameplayStart?.());
  }

  gameplayStop(): void {
    if (!this.sdk) return;
    this.safeCall(() => this.sdk!.game.gameplayStop?.());
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
      let rewarded = false;
      try {
        this.sdk.ad.requestAd(type, {
          adStarted: () => undefined,
          adFinished: () => {
            this.lastAdTime = now;
            if (type === 'rewarded') rewarded = true;
            resolve({ rewarded, played: true });
          },
          adError: () => resolve({ rewarded: false, played: false }),
        });
      } catch {
        // Disabled environment throws on `sdk.ad` access — disable for future calls.
        this.sdk = null;
        this.available = false;
        resolve({ rewarded: false, played: false });
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
    const platform = this;
    return {
      cloudGet(key) {
        try {
          return data.getItem!(key);
        } catch (err) {
          platform.sdk = null;
          platform.available = false;
          return Promise.reject(err);
        }
      },
      cloudSet(key, value) {
        try {
          return data.setItem!(key, value);
        } catch (err) {
          platform.sdk = null;
          platform.available = false;
          return Promise.reject(err);
        }
      },
    };
  }
}
