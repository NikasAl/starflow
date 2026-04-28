// ============================================================
// Поток — Ad Manager
// Platform-aware rewarded ad interface
// Web: Yandex Advertising Network (РСЯ) HTML5 JS SDK
// Android: Yandex Mobile Ads SDK via Capacitor native plugin
// ============================================================

import { Capacitor } from '@capacitor/core';
import { AD_CONFIG } from './ad-config';
import { loadWebAdSdk, showWebRewardedAd } from './web-ads';
import { YandexAds } from './android-ads';

/** Maximum time to wait for ad to load/show before timing out (ms) */
const AD_TIMEOUT_MS = 30_000;

/**
 * Creates a Promise that rejects after a given timeout.
 * If the main promise settles first, the timeout is cleared.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[AdManager] ${label} timed out after ${ms}ms`);
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

class AdManager {
  private sdkReady = false;

  /**
   * Initialize the ad SDK. Call early (e.g. during game startup).
   * Web: starts loading the Yandex JS SDK script.
   * Android: SDK initialized automatically by native plugin load().
   */
  async init(): Promise<void> {
    if (this.sdkReady) return;

    console.log('[AdManager] init() called, platform=' + (Capacitor.isNativePlatform() ? 'native' : 'web'));

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
   * Includes a safety timeout to prevent infinite hangs.
   */
  async showRewardedAd(): Promise<boolean> {
    console.log('[AdManager] showRewardedAd() called, sdkReady=' + this.sdkReady);

    if (!this.sdkReady) {
      console.warn('[AdManager] SDK not ready, skipping ad');
      return false;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        console.log('[AdManager] Calling native showRewardedAd with unitId=' + AD_CONFIG.android.rewardedAdUnitId);
        const result = await withTimeout(
          YandexAds.showRewardedAd({
            adUnitId: AD_CONFIG.android.rewardedAdUnitId,
          }),
          AD_TIMEOUT_MS,
          'Native showRewardedAd',
        );
        console.log('[AdManager] Native ad result: granted=' + result.granted);
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
