// ============================================================
// Поток — Web Ads (Yandex Advertising Network)
// Rewarded video ads via Yandex HTML5 JS SDK
// ============================================================

import { AD_CONFIG } from './ad-config';

/** Load the Yandex Ads SDK script (idempotent). Resolves when ready or on failure. */
export async function loadWebAdSdk(): Promise<void> {
  const w = window as any;
  if (w.Ya?.Context?.AdvManager) return; // already loaded

  // Initialize callback queue — the SDK calls all queued fns when ready
  w.yaContextCb = w.yaContextCb || [];

  return new Promise((resolve) => {
    // Check again in case it loaded between the first check and script creation
    if (w.Ya?.Context?.AdvManager) { resolve(); return; }

    const script = document.createElement('script');
    script.src = AD_CONFIG.web.sdkUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.warn('[WebAds] Failed to load Yandex Ads SDK script');
      resolve(); // don't block — showRewardedAd will fail gracefully
    };
    document.head.appendChild(script);
  });
}

/**
 * Show a rewarded ad via Yandex HTML5 SDK.
 * Creates a temporary container, renders the ad, and returns whether the user earned the reward.
 */
export function showWebRewardedAd(adUnitId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const w = window as any;

    if (!w.Ya?.Context?.AdvManager) {
      console.warn('[WebAds] Yandex Ads SDK not loaded');
      resolve(false);
      return;
    }

    // Create a hidden container for the ad
    const container = document.createElement('div');
    container.id = 'yandex-rewarded-ad-container';
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;';
    document.body.appendChild(container);

    // Push render call into the SDK callback queue
    const renderFn = () => {
      w.Ya.Context.AdvManager.render({
        blockId: adUnitId,
        renderTo: 'yandex-rewarded-ad-container',
        type: 'rewarded' as any,
        onRewarded: (wasShown: boolean) => {
          cleanup();
          resolve(wasShown === true);
        },
        onClose: () => {
          cleanup();
          resolve(false); // closed without reward
        },
        onError: (error: any) => {
          console.warn('[WebAds] Ad error:', error);
          cleanup();
          resolve(false);
        },
      });
    };

    // If SDK is ready, call immediately; otherwise queue it
    if (w.Ya?.Context?.AdvManager) {
      renderFn();
    } else {
      w.yaContextCb = w.yaContextCb || [];
      w.yaContextCb.push(renderFn);
    }

    function cleanup() {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  });
}
