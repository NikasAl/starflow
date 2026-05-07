// ============================================================
// Поток — Ad Unit Configuration
// Different ad unit IDs per platform (Web vs Android)
// ============================================================

export const AD_CONFIG = {
  /** Yandex Advertising Network (РСЯ) — web browser ads */
  web: {
    /** Rewarded ad block ID from partner.yandex.ru */
    rewardedAdUnitId: 'R-A-XXXXXX', // TODO: Set your Yandex web ad unit ID
    /** Yandex Ads JS SDK URL */
    sdkUrl: 'https://yandex.ru/ads/system/context.js',
  },
  /** Yandex Mobile Ads SDK — Android native */
  android: {
    /** Rewarded ad unit ID from РСЯ partner interface */
    rewardedAdUnitId: 'R-M-19173175-1',
    /** Interstitial ad unit ID — shown between game levels */
    interstitialAdUnitId: 'R-M-19173175-2',
    /** Yandex Mobile Ads SDK version (published on Maven Central) */
    sdkVersion: '7.18.5',
  },
};
