import type { CrazyGamesSDK as SDK } from '../types/global';

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

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
      await sdk.init();
      this.sdk = sdk;
      this.available = true;
      sdk.game.loadingStop?.();
    } catch {
      // SDK unavailable (e.g. running on GitHub Pages or offline)
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
      // Time out after 3 seconds if the CDN is blocked.
      const timeout = setTimeout(() => reject(new Error('SDK timeout')), 3000);
      s.addEventListener('load', () => clearTimeout(timeout), { once: true });
      document.head.appendChild(s);
    });
  }

  gameplayStart(): void {
    this.sdk?.game.gameplayStart?.();
  }

  gameplayStop(): void {
    this.sdk?.game.gameplayStop?.();
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
        resolve({ rewarded: false, played: false });
      }
    });
  }

  cloudAdapter(): CrazyAdapter | null {
    if (!this.sdk || !this.sdk.data.getItem || !this.sdk.data.setItem) return null;
    const getItem = this.sdk.data.getItem;
    const setItem = this.sdk.data.setItem;
    return {
      cloudGet: (key) => getItem(key),
      cloudSet: (key, value) => setItem(key, value),
    };
  }
}
