import { describe, it, expect, vi, afterEach } from 'vitest';
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

  const jsonResponse = (body: unknown) => ({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => body,
  });

  it('maps the real deposit response (internal status, chargeAmount) to the public shape', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        transactionId: 'tx_1',
        status: 'PENDING_PIN',
        operator: 'ORANGE_CMR',
        chargeAmount: 25000,
        chargeCurrency: 'XAF',
        instruction: 'Composez #150*50# pour valider',
        environment: 'test',
      })
    );
    const client = createClient({ appId: 'app_123', fetch: mockFetch });
    const res = await client.payments.initiate({ operator: 'ORANGE', phone: '690000000', amount: 25000 });

    expect(res.status).toBe('PENDING');
    expect(res.amount).toBe(25000);
    expect(res.currency).toBe('XAF');
    expect(res.instruction).toContain('#150');
    expect(res.environment).toBe('test');
  });

  it('maps a synchronous COMPLETED / FAILED charge to SUCCESS / FAILED', async () => {
    for (const [internal, expected] of [['COMPLETED', 'SUCCESS'], ['FAILED', 'FAILED']] as const) {
      const mockFetch = vi.fn().mockResolvedValue(
        jsonResponse({ success: true, transactionId: 'tx', status: internal, operator: 'MTN_CMR', chargeAmount: 1000, chargeCurrency: 'XAF' })
      );
      const client = createClient({ appId: 'app_123', fetch: mockFetch });
      const res = await client.payments.initiate({ operator: 'MTN', phone: '670000000', amount: 1000 });
      expect(res.status).toBe(expected);
    }
  });

  it('builds the operator code from `country` and strips phone separators', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ success: true, transactionId: 'tx', status: 'INITIATED', operator: 'WAVE_CIV' }));
    const client = createClient({ appId: 'app_123', fetch: mockFetch });
    await client.payments.initiate({ operator: 'wave', country: 'ci', phone: '(07) 01.02.03.04', amount: 5000 });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operator).toBe('WAVE_CIV');
    expect(body.phone).toBe('0701020304');
  });

  it('keeps a full operator code and rejects an unsupported country', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ success: true, transactionId: 'tx', status: 'INITIATED', operator: 'MTN_CMR' }));
    const client = createClient({ appId: 'app_123', fetch: mockFetch });
    await client.payments.initiate({ operator: 'MTN_CMR', country: 'CI', phone: '670000000', amount: 1000 });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).operator).toBe('MTN_CMR');

    await expect(
      client.payments.initiate({ operator: 'MTN', country: 'NG', phone: '8030000000', amount: 1000 })
    ).rejects.toThrow(NietemoPaymentError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('waitForStatus stops on COMPLETED and exposes the failure reason', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, transactionId: 'tx', status: 'PENDING_PIN', operator: 'MTN_CMR', amount: 1, currency: 'XAF', createdAt: 'x' }))
      .mockResolvedValueOnce(jsonResponse({ success: true, transactionId: 'tx', status: 'FAILED', failureReason: 'PIN_REJECTED', operator: 'MTN_CMR', amount: 1, currency: 'XAF', createdAt: 'x' }));
    const client = createClient({ appId: 'app_123', fetch: mockFetch });

    const result = await client.payments.waitForStatus('tx', { intervalMs: 1, timeoutMs: 1000 });
    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toBe('PIN_REJECTED');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('Mobile Money coverage', () => {
  it('lists the 18 supported countries with ISO2/ISO3 lookup', async () => {
    const { MOBILE_MONEY_COUNTRIES, getMobileMoneyCountry } = await import('../src');
    expect(MOBILE_MONEY_COUNTRIES).toHaveLength(18);
    expect(getMobileMoneyCountry('cm')?.iso3).toBe('CMR');
    expect(getMobileMoneyCountry('SEN')?.currency).toBe('XOF');
    expect(getMobileMoneyCountry('NG')).toBeUndefined();
  });
});

describe('payments.checkout (Swinmo inline modal)', () => {
  const json = (body: unknown) => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => body });
  const SESSION = { success: true, transactionId: 'tx_cs_1', sessionId: 'cs_test_1', amount: 5000, currency: 'XAF', environment: 'test' };

  function withModal(behaviour: (cb: any) => void) {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});
    vi.stubGlobal('SwinmoPay', { init: (opts: any) => setTimeout(() => behaviour(opts), 0) });
  }

  afterEach(() => vi.unstubAllGlobals());

  it('creates a session without asking for phone/operator, opens the modal and waits for the server', async () => {
    const opened: string[] = [];
    withModal((cb) => {
      opened.push(cb.session);
      cb.onSuccess({ session_id: cb.session });
    });
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(json(SESSION))
      .mockResolvedValueOnce(json({ success: true, transactionId: 'tx_cs_1', status: 'COMPLETED', operator: 'MTN_CMR', amount: 5000, currency: 'XAF', createdAt: 'x' }));
    const client = createClient({ appId: 'app_123', fetch: mockFetch });

    const result = await client.payments.checkout({ amount: 5000, title: 'Commande #7' });

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/api/payments/checkout');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ appId: 'app_123', amount: 5000, currency: 'XAF', title: 'Commande #7' });
    expect(body.phone).toBeUndefined();
    expect(body.operator).toBeUndefined();
    expect(opened).toEqual(['cs_test_1']);
    expect(result).toMatchObject({ transactionId: 'tx_cs_1', status: 'SUCCESS', environment: 'test' });
  });

  it('reports CANCELLED when the payer closes the modal, without polling', async () => {
    withModal((cb) => cb.onClose());
    const mockFetch = vi.fn().mockResolvedValueOnce(json(SESSION));
    const client = createClient({ appId: 'app_123', fetch: mockFetch });

    const result = await client.payments.checkout({ amount: 5000 });
    expect(result.status).toBe('CANCELLED');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the modal open on errors and reports the last one only if closed unpaid', async () => {
    withModal((cb) => {
      cb.onError({ code: 'provider_error', message: 'Solde insuffisant' });
      cb.onClose();
    });
    const client = createClient({ appId: 'app_123', fetch: vi.fn().mockResolvedValueOnce(json(SESSION)) });

    const result = await client.payments.checkout({ amount: 5000 });
    expect(result).toMatchObject({ status: 'FAILED', errorMessage: 'Solde insuffisant' });
  });

  it('refuses to run outside a browser', async () => {
    const client = createClient({ appId: 'app_123', fetch: vi.fn() });
    await expect(client.payments.checkout({ amount: 5000 })).rejects.toThrow(/browser/);
  });
});
