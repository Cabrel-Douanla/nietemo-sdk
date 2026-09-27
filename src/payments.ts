import type { NietemoClient } from './client';
import type {
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentStatusResponse,
} from './types/payments';
import { NietemoPaymentError } from './errors';

export class NietemoPayments {
  private readonly client: NietemoClient;

  constructor(client: NietemoClient) {
    this.client = client;
  }

  /**
   * Initiate a Mobile Money STK Push deposit (Orange Money, MTN MoMo, Wave, etc.)
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

    try {
      const payload = {
        appId: this.client.appId,
        operator: order.operator.toUpperCase(),
        phone: order.phone.replace(/[\s-]/g, ''),
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

      return res;
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

    return this.client.request<PaymentStatusResponse>(
      `/api/payments/status?transactionId=${encodeURIComponent(transactionId)}&appId=${encodeURIComponent(
        this.client.appId
      )}`,
      { method: 'GET' }
    );
  }

  /**
   * Poll for transaction completion until a final status (SUCCESS, FAILED, EXPIRED) is reached
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
      if (status.status === 'SUCCESS' || status.status === 'FAILED' || status.status === 'EXPIRED') {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new NietemoPaymentError(
      `Payment status polling timed out after ${timeoutMs}ms for transaction ${transactionId}`
    );
  }
}
