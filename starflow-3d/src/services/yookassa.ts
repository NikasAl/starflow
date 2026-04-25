// ============================================================
// Star Flow Command — YooKassa Payment Service
// API integration with kreagenium.ru/cm backend
// ============================================================

const API_BASE = 'https://kreagenium.ru/cm';

export interface EnergyProduct {
  amount: number;    // price in rubles
  energy: number;    // energy amount granted
  name: string;      // product name (i18n key will be used)
  type: string;
}

export interface PaymentResult {
  invoice_id: string;
  payment_url: string;
  amount: number;
}

export interface PaymentStatus {
  invoice_id: string;
  is_paid: boolean;
}

// Product configuration (mirrors server APP_PRODUCTS)
export const ENERGY_PRODUCTS: EnergyProduct[] = [
  { amount: 10, energy: 10, name: 'scout', type: 'energy' },
  { amount: 25, energy: 30, name: 'commander', type: 'energy' },
  { amount: 79, energy: 100, name: 'admiral', type: 'energy' },
];

// Get or generate device ID
function getDeviceId(): string {
  let id = localStorage.getItem('starflow_device_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    localStorage.setItem('starflow_device_id', id);
  }
  return id;
}

export async function createPayment(amount: number): Promise<PaymentResult> {
  const device_id = getDeviceId();
  const resp = await fetch(`${API_BASE}/billing/create/starflow`, {
    method: 'POST',
    body: JSON.stringify({ device_id, amount, app: 'starflow' }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Payment creation failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

/**
 * Check payment status.
 * Uses the unified /billing/check/{payment_id} endpoint.
 * Throws on network/server errors so the caller can stop checking.
 * Returns is_paid=false for unpaid payments (caller shows pending UI).
 */
export async function checkPayment(paymentId: string): Promise<PaymentStatus> {
  const resp = await fetch(`${API_BASE}/billing/check/${encodeURIComponent(paymentId)}`);
  if (!resp.ok) {
    throw new Error(`Payment check failed: ${resp.status}`);
  }
  const data = await resp.json();

  // If the server returned an error indicator, throw
  if (data.error) {
    throw new Error(`Payment check error: ${data.error}`);
  }

  return data as PaymentStatus;
}

// ============================================================
// Deep Link Handling (starflow://payment/success)
// The server creates a redirect link WITHOUT invoice_id parameter.
// The app is still running (paused) and remembers the payment_id
// from when the payment was created. Deep link is just a trigger.
// ============================================================

export type PaymentDeepLinkCallback = () => void;

let deepLinkCallback: PaymentDeepLinkCallback | null = null;

/** Set callback for when app receives a payment deep link (no params needed) */
export function setPaymentDeepLinkCallback(cb: PaymentDeepLinkCallback): void {
  deepLinkCallback = cb;
}

/** Manually trigger the deep link callback (e.g. for deferred browser deep links) */
export function triggerPaymentDeepLink(): void {
  if (deepLinkCallback) {
    deepLinkCallback();
  }
}

/**
 * Initialize deep link listener.
 * Works with both Capacitor (appUrlOpen) and browser (URL check on load).
 * Call once at app startup.
 */
export function initDeepLinkHandler(): void {
  // --- Capacitor native deep link ---
  try {
    const { App } = require('@capacitor/app');
    App.addListener('appUrlOpen', (event: { url: string }) => {
      if (event.url.startsWith('starflow://payment/success')) {
        console.log('[YooKassa] Deep link received (no params):', event.url);
        if (deepLinkCallback) {
          deepLinkCallback();
        }
      }
    });
    console.log('[YooKassa] Capacitor deep link listener registered');
  } catch {
    // @capacitor/app not available (web dev mode)
    console.log('[YooKassa] Capacitor App not available, using URL check');
  }

  // --- Browser: check current URL on page load (handles direct navigation) ---
  if (typeof window !== 'undefined' && window.location) {
    const href = window.location.href;
    if (href.includes('starflow://payment/success')) {
      // Store flag for later pickup (game may not be initialized yet)
      sessionStorage.setItem('starflow_deep_link_received', '1');
      // Clean URL so refresh doesn't re-trigger
      window.history.replaceState({}, '', '/');
    }
  }
}

/**
 * Check if there's a pending deep link flag from page load (sessionStorage).
 * Call after game is initialized to process any deferred deep link.
 */
export function consumePendingDeepLink(): boolean {
  const flag = sessionStorage.getItem('starflow_deep_link_received');
  if (flag) {
    sessionStorage.removeItem('starflow_deep_link_received');
    return true;
  }
  return false;
}

// Persist pending payment locally so deep link handler can reference it
export function savePendingPayment(invoiceId: string, energyAmount: number): void {
  localStorage.setItem('starflow_pending_payment_id', invoiceId);
  localStorage.setItem('starflow_pending_energy', String(energyAmount));
}

export function loadPendingPayment(): { invoiceId: string; energyAmount: number } | null {
  const invoiceId = localStorage.getItem('starflow_pending_payment_id');
  const energyAmount = localStorage.getItem('starflow_pending_energy');
  if (invoiceId && energyAmount) {
    return { invoiceId, energyAmount: parseInt(energyAmount, 10) };
  }
  return null;
}

export function clearPendingPayment(): void {
  localStorage.removeItem('starflow_pending_payment_id');
  localStorage.removeItem('starflow_pending_energy');
}
