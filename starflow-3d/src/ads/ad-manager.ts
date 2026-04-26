// ============================================================
// Star Flow Command — Ad Manager
// Platform-aware rewarded ad interface
// Web: Yandex Advertising Network (РСЯ) HTML5 JS SDK
// Android: Yandex Mobile Ads SDK via Capacitor native plugin
// ============================================================

import { Capacitor } from '@capacitor/core';
import { AD_CONFIG } from './ad-config';
import { loadWebAdSdk, showWebRewardedAd } from './web-ads';
import { YandexAds } from './android-ads';

class AdManager {
  private sdkReady = false;

  /**
   * Initialize the ad SDK. Call early (e.g. during game startup).
   * Web: starts loading the Yandex JS SDK script.
   * Android: SDK initialized automatically by native plugin load().
   */
  async init(): Promise<void> {
    if (this.sdkReady) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await YandexAds.initialize();
        this.sdkReady = true;
        console.log('[AdManager] Native Yandex Ads SDK initialized');
      } catch (e) {
        console.warn('[AdManager] Native ad init failed:', e);
      }
    } else {
      await loadWebAdSdk();
      const w = window as any;
      this.sdkReady = !!(w.Ya?.Context?.AdvManager);
      console.log('[AdManager] Web Yandex Ads SDK', this.sdkReady ? 'ready' : 'not available');
    }
  }

  /**
   * Show a rewarded ad. Returns true if the user earned the reward.
   * Automatically selects the correct platform implementation.
   */
  async showRewardedAd(): Promise<boolean> {
    if (!this.sdkReady) {
      console.warn('[AdManager] SDK not ready, skipping ad');
      return false;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await YandexAds.showRewardedAd({
          adUnitId: AD_CONFIG.android.rewardedAdUnitId,
        });
        return result.granted === true;
      } catch (e) {
        console.warn('[AdManager] Native ad error:', e);
        return false;
      }
    } else {
      return showWebRewardedAd(AD_CONFIG.web.rewardedAdUnitId);
    }
  }

  /** Check if the ad SDK is loaded and ready */
  isReady(): boolean {
    return this.sdkReady;
  }
}

/** Global ad manager instance */
export const adManager = new AdManager();
