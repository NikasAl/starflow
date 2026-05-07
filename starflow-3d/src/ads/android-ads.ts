// ============================================================
// Поток — Android Native Ads Bridge
// Capacitor plugin interface for Yandex Mobile Ads SDK
// Native implementation injected by scripts/setup-android.mjs
// ============================================================

import { registerPlugin } from '@capacitor/core';

export interface YandexAdsPlugin {
  /** Initialize Yandex Mobile Ads SDK (called by native plugin load()) */
  initialize(): Promise<void>;
  /**
   * Load and show a rewarded ad.
   * @returns { granted: boolean, error?: string }
   */
  showRewardedAd(options: { adUnitId: string }): Promise<{ granted: boolean; error?: string }>;
  /**
   * Load and show an interstitial ad (full-screen, between levels).
   * @returns { shown: boolean, error?: string }
   */
  showInterstitialAd(options: { adUnitId: string }): Promise<{ shown: boolean; error?: string }>;
}

/** Capacitor plugin proxy — on web this is a stub (methods will reject). */
export const YandexAds = registerPlugin<YandexAdsPlugin>('YandexAds');
