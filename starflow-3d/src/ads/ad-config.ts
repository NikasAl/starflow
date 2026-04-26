// ============================================================
// Star Flow Command — Ad Unit Configuration
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
    /** Rewarded ad unit ID from partner.yandex.ru (mobile) */
    rewardedAdUnitId: 'demo-rewarded-yandex', // TODO: Set your Yandex mobile ad unit ID
    /** Yandex Mobile Ads SDK version (Maven) */
    sdkVersion: '7.5.0',
    /** Maven repository for Yandex Mobile Ads */
    mavenRepo: 'https://maven.yandex.ru/repository/mobileads/',
  },
};
