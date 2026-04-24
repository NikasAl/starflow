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
  // Intentionally NO Content-Type header to avoid CORS preflight.
  // Without an explicit Content-Type, the browser sends "text/plain"
  // which is a "simple" request — no OPTIONS preflight is triggered.
  // FastAPI still parses the JSON body correctly from the raw request body.
  const resp = await fetch(`${API_BASE}/billing/create-starflow`, {
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
 * Throws on network/server errors so the caller can stop polling.
 * Returns is_paid=false for unpaid invoices (caller continues polling).
 */
export async function checkPayment(invoiceId: string): Promise<PaymentStatus> {
  const resp = await fetch(`${API_BASE}/billing/check/${encodeURIComponent(invoiceId)}`);
  if (!resp.ok) {
    throw new Error(`Payment check failed: ${resp.status}`);
  }
  const data = await resp.json();

  // If the server returned an error indicator (invoice not found, etc.),
  // throw so the caller stops polling rather than retrying endlessly.
  if (data.error) {
    throw new Error(`Payment check error: ${data.error}`);
  }

  return data as PaymentStatus;
}
