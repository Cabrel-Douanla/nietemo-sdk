import type { NietemoClient } from './client';
import type {
  PaymentCheckoutRequest,
  PaymentCheckoutResult,
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentStatus,
  PaymentStatusResponse,
} from './types/payments';
import { FINAL_PAYMENT_STATUSES } from './types/payments';
import { NietemoPaymentError } from './errors';
import { getMobileMoneyCountry } from './countries';
import { openSwinmoCheckout } from './inline';

/** Maps the statuses the server may return (internal or normalized) to PaymentStatus. */
function normalizeStatus(status: string | undefined): PaymentStatus {
  switch ((status ?? '').toUpperCase()) {
    case 'SUCCESS':
    case 'COMPLETED':
    case 'APPROVED':
    case 'SUCCEEDED':
      return 'SUCCESS';
    case 'FAILED':
    case 'REJECTED':
      return 'FAILED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return 'PENDING'; // INITIATED, PENDING_PIN, PROCESSING…
  }
}

export class NietemoPayments {
  private readonly client: NietemoClient;

  constructor(client: NietemoClient) {
    this.client = client;
  }

  /**
   * Recommended way to take a payment in the browser. Opens the Swinmo Pay modal, where the payer picks
   * their country and operator and enters their number (no payment form needed in the app), then waits
   * for the server to confirm the payment.
   *
   * Resolves with the final status: only `SUCCESS` means the money was received.
   */
  public async checkout(order: PaymentCheckoutRequest): Promise<PaymentCheckoutResult> {
    if (!order || !Number.isFinite(order.amount) || order.amount <= 0) {
      throw new NietemoPaymentError('Payment amount must be greater than zero.');
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new NietemoPaymentError(
        'payments.checkout() opens a payment window and must run in the browser. On a server, use payments.initiate().'
      );
    }

    let session: {
      transactionId: string;
      sessionId: string;
      amount: number;
      currency: string;
      orderId?: string;
      environment?: 'live' | 'test';
    };
    try {
      session = await this.client.request('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          appId: this.client.appId,
          amount: order.amount,
          currency: order.currency || 'XAF',
          title: order.title,
          country: order.country,
          customer: order.customer,
          items: order.items,
          metadata: order.metadata || {},
        }),
      });
    } catch (err: any) {
      throw new NietemoPaymentError(err.message || 'Failed to start the payment');
    }

    const base = {
      transactionId: session.transactionId,
      amount: session.amount,
      currency: session.currency,
      orderId: session.orderId,
      environment: session.environment,
    };

    let outcome;
    try {
      outcome = await openSwinmoCheckout(session.sessionId);
    } catch (err: any) {
      throw new NietemoPaymentError(err.message || 'Swinmo Pay could not be opened', undefined, session.transactionId);
    }

    if (outcome.outcome === 'cancel') return { ...base, status: 'CANCELLED' };
    if (outcome.outcome === 'error') return { ...base, status: 'FAILED', errorMessage: outcome.message };

    // The modal's success is only a signal: the payment counts once the server has settled it.
    try {
      const confirmed = await this.waitForStatus(session.transactionId, {
        timeoutMs: order.waitTimeoutMs ?? 120000,
        intervalMs: 2500,
      });
      return { ...base, status: confirmed.status, errorMessage: confirmed.errorMessage };
    } catch {
      return { ...base, status: 'PENDING' };
    }
  }

  /**
   * Advanced: charge a Mobile Money number collected by the app itself (server-side flows, kiosks…).
   * In the browser prefer `checkout()`, which collects these details for you.
   * The customer receives a prompt on their phone; follow the outcome with `getStatus` or `waitForStatus`.
   * @param order Payment order specifications
   */
  public async initiate(order: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    if (!order.phone || !order.amount || !order.operator) {
      throw new NietemoPaymentError(
        'Missing required payment parameters: phone, amount, and operator are mandatory.',
        order.operator
      );
    }

    if (order.amount <= 0) {
      throw new NietemoPaymentError('Payment amount must be greater than zero.', order.operator);
    }

    let operator = order.operator.toUpperCase();
    if (order.country && !/_[A-Z]{3}$/.test(operator)) {
      const country = getMobileMoneyCountry(order.country);
      if (!country) {
        throw new NietemoPaymentError(`Unsupported country "${order.country}" for Mobile Money.`, order.operator);
      }
      operator = `${operator}_${country.iso3}`;
    }

    try {
      const payload = {
        appId: this.client.appId,
        operator,
        phone: order.phone.replace(/[\s.\-()]/g, ''),
        amount: order.amount,
        currency: order.currency || 'XAF',
        title: order.title || `Paiement ${order.operator}`,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        metadata: order.metadata || {},
      };

      const res = await this.client.request<PaymentInitiateResponse>(
        '/api/payments/deposit',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      return {
        ...res,
        status: normalizeStatus(res.status),
        // The server reports the converted charge as chargeAmount / chargeCurrency.
        amount: res.amount ?? (res as any).chargeAmount ?? order.amount,
        currency: res.currency ?? (res as any).chargeCurrency ?? order.currency ?? 'XAF',
      };
    } catch (err: any) {
      throw new NietemoPaymentError(
        err.message || 'Failed to initiate Mobile Money payment',
        order.operator
      );
    }
  }

  /**
   * Retrieve current real-time status of a payment transaction
   * @param transactionId Transaction or deposit reference
   */
  public async getStatus(transactionId: string): Promise<PaymentStatusResponse> {
    if (!transactionId) {
      throw new NietemoPaymentError('transactionId is required to query payment status');
    }

    const res = await this.client.request<PaymentStatusResponse>(
      `/api/payments/status?transactionId=${encodeURIComponent(transactionId)}&appId=${encodeURIComponent(
        this.client.appId
      )}`,
      { method: 'GET' }
    );
    return {
      ...res,
      status: normalizeStatus(res.status),
      errorMessage: res.errorMessage ?? res.failureReason ?? undefined,
    };
  }

  /**
   * Poll for transaction completion until a final status (SUCCESS, FAILED, EXPIRED, CANCELLED) is reached
   * @param transactionId Transaction reference
   * @param options Polling configuration (timeoutMs default 60000ms, intervalMs default 3000ms)
   */
  public async waitForStatus(
    transactionId: string,
    options: { timeoutMs?: number; intervalMs?: number } = {}
  ): Promise<PaymentStatusResponse> {
    const timeoutMs = options.timeoutMs || 60000;
    const intervalMs = options.intervalMs || 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getStatus(transactionId);
      if (FINAL_PAYMENT_STATUSES.includes(status.status)) {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new NietemoPaymentError(
      `Payment status polling timed out after ${timeoutMs}ms for transaction ${transactionId}`
    );
  }
}
