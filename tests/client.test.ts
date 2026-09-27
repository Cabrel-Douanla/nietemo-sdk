import { describe, it, expect, vi } from 'vitest';
import { createClient, NietemoClient, NietemoError, NietemoAPIError } from '../src';

describe('NietemoClient Core', () => {
  it('should initialize with required appId', () => {
    const client = createClient({ appId: 'app_test_123' });
    expect(client).toBeInstanceOf(NietemoClient);
    expect(client.appId).toBe('app_test_123');
    expect(client.endpoint).toBe('https://api.nietemo.site');
  });

  it('should throw NietemoError if appId is missing', () => {
    expect(() => createClient({ appId: '' })).toThrow(NietemoError);
  });

  it('should respect custom endpoint and trim trailing slashes', () => {
    const client = createClient({
      appId: 'app_123',
      endpoint: 'https://custom.api.nietemo.site///',
    });
    expect(client.endpoint).toBe('https://custom.api.nietemo.site');
  });

  it('should inject correct headers on requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    });

    const client = createClient({
      appId: 'app_999',
      apiKey: 'flit_pk_live_testkey',
      fetch: mockFetch,
    });

    await client.request('/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.nietemo.site/test');
    expect(init.headers['X-Nietemo-App-Id']).toBe('app_999');
    expect(init.headers['Authorization']).toBe('Bearer flit_pk_live_testkey');
    expect(init.headers['X-Nietemo-Api-Key']).toBe('flit_pk_live_testkey');
  });

  it('should throw NietemoAPIError on HTTP 400/500 responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Collection not found', code: 'NOT_FOUND' }),
    });

    const client = createClient({
      appId: 'app_123',
      fetch: mockFetch,
    });

    await expect(client.request('/missing')).rejects.toThrow(NietemoAPIError);
  });

  it('CRITICAL SECURITY: should throw NietemoError if a Secret Key (flit_sk_) is passed in a browser environment', () => {
    // Simulate browser window
    vi.stubGlobal('window', {});

    try {
      expect(() => {
        createClient({
          appId: 'app_123',
          apiKey: 'flit_sk_live_secret_admin_key_should_never_be_in_browser',
        });
      }).toThrowError(/CRITICAL SECURITY VIOLATION/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
