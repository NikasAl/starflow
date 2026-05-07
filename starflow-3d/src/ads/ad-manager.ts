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

class AdManager {
  private sdkReady = false;

  /**
   * Initialize the ad SDK. Call early (e.g. during game startup).
   * Web: starts loading the Yandex JS SDK script.
   * Android: SDK initialized automatically by native plugin load().
   */
  async init(): Promise<void> {
    if (this.sdkReady) return;

    const platform = Capacitor.isNativePlatform() ? 'native' : 'web';
    console.warn(`[AdManager] init() platform=${platform}, Capacitor.isNative=${Capacitor.isNativePlatform()}`);

    if (Capacitor.isNativePlatform()) {
      try {
        // Native plugin initializes SDK in load(). The initialize() call
        // just confirms readiness — it always resolves immediately.
        console.warn('[AdManager] Calling YandexAds.initialize()...');
        await Promise.race([
          YandexAds.initialize(),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]);
        this.sdkReady = true;
        console.warn('[AdManager] Native Yandex Ads SDK ready');
      } catch (e) {
        // Even if init fails, SDK may still work (load() already init'd it).
        // Mark as ready so showRewardedAd at least tries to call native.
        this.sdkReady = true;
        console.warn('[AdManager] Native ad init error (continuing anyway):', e);
      }
    } else {
      await loadWebAdSdk();
      const w = window as any;
      this.sdkReady = !!(w.Ya?.Context?.AdvManager);
      console.warn('[AdManager] Web Yandex Ads SDK', this.sdkReady ? 'ready' : 'not available');
    }
  }

  /**
   * Show a rewarded ad. Returns true if the ad was shown and dismissed.
   * Automatically selects the correct platform implementation.
   * Includes a safety timeout to prevent infinite hangs.
   *
   * The native plugin now resolves ONLY on onAdDismissed (not on onRewarded),
   * so the promise stays pending while the ad is visible. This fixes mediation
   * partners (e.g. Mintegral) that fire onRewarded before the user closes the ad.
   * The granted flag is ignored — if the ad was shown and dismissed, reward is granted.
   * Errors (failed to load, failed to show, timeout) reject the promise → no reward.
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
        // No JS-side timeout — mediated ads (e.g. Mintegral) can run 60+ seconds.
        // The native SDK handles its own timeouts via onAdFailedToLoad/onAdFailedToShow.
        await YandexAds.showRewardedAd({
          adUnitId: AD_CONFIG.android.rewardedAdUnitId,
        });
        // Ad was shown (promise resolved without error). Grant reward
        // regardless of the `granted` flag — mediation partners may not
        // fire the onRewarded callback.
        console.log('[AdManager] Native ad completed — granting reward');
        return true;
      } catch (e) {
        // Ad failed to load/show — no reward.
        console.warn('[AdManager] Native ad error (no reward):', e);
        return false;
      }
    } else {
      return showWebRewardedAd(AD_CONFIG.web.rewardedAdUnitId);
    }
  }

  /**
   * Show an interstitial ad (full-screen between levels).
   * Returns true if the ad was shown. If unavailable, returns false silently.
   * No reward — purely for monetization.
   */
  async showInterstitialAd(): Promise<boolean> {
    console.log('[AdManager] showInterstitialAd() called, sdkReady=' + this.sdkReady);

    if (!this.sdkReady) {
      console.warn('[AdManager] SDK not ready, skipping interstitial');
      return false;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        console.log('[AdManager] Calling native showInterstitialAd with unitId=' + AD_CONFIG.android.interstitialAdUnitId);
        await YandexAds.showInterstitialAd({
          adUnitId: AD_CONFIG.android.interstitialAdUnitId,
        });
        console.log('[AdManager] Interstitial ad completed');
        return true;
      } catch (e) {
        // Ad failed to load/show — continue to next level silently
        console.warn('[AdManager] Interstitial ad error (continuing):', e);
        return false;
      }
    } else {
      // Web: interstitial not supported via JS SDK in this context
      console.warn('[AdManager] Interstitial ads not supported on web');
      return false;
    }
  }

  /** Check if the ad SDK is loaded and ready */
  isReady(): boolean {
    return this.sdkReady;
  }
}

/** Global ad manager instance */
export const adManager = new AdManager();
