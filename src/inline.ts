/**
 * Browser loader for the Swinmo Pay inline checkout (https://pay.swinmo.shop/v1/inline.js, SDK v2).
 *
 * The page only ever receives a checkout session id created by the Nietemo server; Swinmo's modal collects
 * the payer's country, operator and phone number. `onSuccess` is a UX signal only: the payment is confirmed
 * server-side (webhook or reconciliation), which `NietemoPayments.checkout` waits for.
 */

export const SWINMO_INLINE_SCRIPT_URL = 'https://pay.swinmo.shop/v1/inline.js';

interface SwinmoPayGlobal {
  init(options: {
    session: string;
    onSuccess?: (result: { session_id?: string; charge_id?: string; reference?: string }) => void;
    onPending?: (result?: unknown) => void;
    onCancel?: () => void;
    onClose?: () => void;
    onReady?: () => void;
    onError?: (error: { code?: string; message?: string }) => void;
  }): unknown;
}

export type InlineCheckoutOutcome =
  | { outcome: 'success' }
  /** Closed while the operator was still validating: the server will settle it. */
  | { outcome: 'pending' }
  | { outcome: 'cancel' }
  | { outcome: 'error'; message: string };

let loading: Promise<SwinmoPayGlobal> | null = null;

function getGlobal(): SwinmoPayGlobal | undefined {
  return (globalThis as any).SwinmoPay as SwinmoPayGlobal | undefined;
}

export function loadSwinmoInline(): Promise<SwinmoPayGlobal> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Swinmo Pay checkout requires a browser.'));
  }
  const existing = getGlobal();
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;

  loading = new Promise<SwinmoPayGlobal>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SWINMO_INLINE_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const swinmo = getGlobal();
      if (swinmo) resolve(swinmo);
      else {
        loading = null;
        reject(new Error('Swinmo Pay est indisponible.'));
      }
    };
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error('Impossible de charger Swinmo Pay. Vérifiez votre connexion.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Delay that lets a trailing onSuccess/onPending win over the onClose fired when the modal shuts. */
const CLOSE_GRACE_MS = 400;

/**
 * Opens the Swinmo modal and resolves once the customer is done with it. Errors are not final (the modal
 * stays open for another attempt): the last one is only reported if the customer closes it unpaid.
 */
export async function openSwinmoCheckout(sessionId: string): Promise<InlineCheckoutOutcome> {
  const swinmo = await loadSwinmoInline();
  return new Promise((resolve) => {
    let lastError: string | null = null;
    const closed = () =>
      setTimeout(() => resolve(lastError ? { outcome: 'error', message: lastError } : { outcome: 'cancel' }), CLOSE_GRACE_MS);

    swinmo.init({
      session: sessionId,
      onSuccess: () => resolve({ outcome: 'success' }),
      onPending: () => resolve({ outcome: 'pending' }),
      onCancel: closed,
      onClose: closed,
      onError: (error) => {
        lastError = error?.message || 'Le paiement a échoué.';
      },
    });
  });
}
