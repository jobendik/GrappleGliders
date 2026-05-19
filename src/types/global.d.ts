/// <reference types="vite/client" />

/**
 * CrazyGames SDK v3 partial typings — covers only the surface we call.
 * The SDK loads dynamically; missing methods are guarded at runtime.
 */
export interface CrazyAdsModule {
  requestAd(
    type: 'midgame' | 'rewarded',
    callbacks: {
      adStarted?: () => void;
      adFinished?: () => void;
      adError?: (err: unknown) => void;
    },
  ): void;
}

export interface CrazyGameModule {
  loadingStart?: () => void;
  loadingStop?: () => void;
  gameplayStart?: () => void;
  gameplayStop?: () => void;
  happytime?: () => void;
}

export interface CrazyDataModule {
  setItem?: (key: string, value: string) => Promise<void>;
  getItem?: (key: string) => Promise<string | null>;
  removeItem?: (key: string) => Promise<void>;
}

export interface CrazyUserModule {
  isUserAccountAvailable?: () => Promise<boolean>;
  getUser?: () => Promise<{ username: string; profilePictureUrl?: string } | null>;
}

export interface CrazyGamesSDK {
  init: () => Promise<void>;
  game: CrazyGameModule;
  ad: CrazyAdsModule;
  data: CrazyDataModule;
  user: CrazyUserModule;
}

declare global {
  interface Window {
    CrazyGames?: {
      SDK: CrazyGamesSDK;
    };
    // reason: webkitAudioContext is the legacy iOS Safari fallback.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitAudioContext?: any;
  }
}

export {};
