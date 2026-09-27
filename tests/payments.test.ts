import { describe, it, expect, vi } from 'vitest';
import { createClient, NietemoPaymentError } from '../src';

describe('NietemoClient Mobile Money Payments', () => {
  it('should validate mandatory fields on initiate()', async () => {
    const client = createClient({ appId: 'app_123' });

    // Missing operator
    await expect(
      client.payments.initiate({
        phone: '690000000',
        amount: 5000,
      } as any)
    ).rejects.toThrow(NietemoPaymentError);

    // Amount <= 0
    await expect(
      client.payments.initiate({
        operator: 'ORANGE',
        phone: '690000000',
        amount: 0,
      })
    ).rejects.toThrow(NietemoPaymentError);
  });

  it('should send correct deposit request to Nietemo payment route', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        transactionId: 'tx_om_12345',
        status: 'PENDING',
        operator: 'ORANGE',
        amount: 25000,
        currency: 'XAF',
      }),
    });

    const client = createClient({ appId: 'app_123', fetch: mockFetch });
    const res = await client.payments.initiate({
      operator: 'ORANGE',
      phone: '+237 690-00-00-00',
      amount: 25000,
      currency: 'XAF',
      title: 'Facture #99',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.nietemo.site/api/payments/deposit');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    expect(body.appId).toBe('app_123');
    expect(body.operator).toBe('ORANGE');
    expect(body.phone).toBe('+237690000000'); // spaces/dashes stripped
    expect(body.amount).toBe(25000);

    expect(res.transactionId).toBe('tx_om_12345');
    expect(res.status).toBe('PENDING');
  });

  it('should query payment status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        transactionId: 'tx_om_12345',
        status: 'SUCCESS',
        operator: 'ORANGE',
        amount: 25000,
        currency: 'XAF',
        createdAt: '2026-01-01T12:00:00Z',
      }),
    });

    const client = createClient({ appId: 'app_123', fetch: mockFetch });
    const status = await client.payments.getStatus('tx_om_12345');

    expect(status.status).toBe('SUCCESS');
    expect(status.amount).toBe(25000);
  });
});
