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
   * Show a rewarded ad. Returns true if the ad was shown to the user.
   * Automatically selects the correct platform implementation.
   * Includes a safety timeout to prevent infinite hangs.
   *
   * NOTE: On native, the reward is granted whenever the ad promise resolves
   * without error, regardless of the `granted` flag from the SDK. Mediation
   * partners may not report the reward callback, but the user still watched
   * the ad — so we consider it a successful show.
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
        await withTimeout(
          YandexAds.showRewardedAd({
            adUnitId: AD_CONFIG.android.rewardedAdUnitId,
          }),
          AD_TIMEOUT_MS,
          'Native showRewardedAd',
        );
        // Ad was shown (promise resolved without error). Grant reward
        // regardless of the `granted` flag — mediation partners may not
        // fire the onRewarded callback.
        console.log('[AdManager] Native ad completed — granting reward');
        return true;
      } catch (e) {
        // Ad failed to load/show or timed out — no reward.
        console.warn('[AdManager] Native ad error (no reward):', e);
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
