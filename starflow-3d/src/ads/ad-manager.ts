// ============================================================
// Star Flow Command — Ad Manager (Stub)
// Abstracted rewarded ad interface for future Yandex Ads / RuStore integration
// ============================================================

/**
 * Abstracted ad manager for rewarded video ads.
 * Currently a stub that immediately grants rewards.
 * Replace with Yandex Ads SDK for RuStore release.
 */
class AdManager {
  private ready = true;

  /**
   * Show a rewarded ad. Returns true if the reward was granted.
   * Stub: always grants reward immediately.
   * Future: integrate Yandex Ads SDK or RuStore ad network.
   */
  async showRewardedAd(): Promise<boolean> {
    // TODO: Replace with actual Yandex Ads SDK call for RuStore
    // Example (Yandex Ads SDK):
    //   window.ymads?.showRewarded?.(() => resolve(true), () => resolve(false));
    return true;
  }

  /** Check if an ad is ready to be shown */
  isReady(): boolean {
    return this.ready;
  }
}

/** Global ad manager instance */
export const adManager = new AdManager();
