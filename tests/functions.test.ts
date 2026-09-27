import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, NietemoClient } from '../src';

describe('Nietemo Server Functions SDK', () => {
  let client: NietemoClient;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = createClient({
      appId: 'test-app-123',
      fetch: mockFetch,
    });
  });

  it('exposes the functions service on client instance', () => {
    expect(client.functions).toBeDefined();
    expect(typeof client.functions.invoke).toBe('function');
  });

  it('validates empty function name', async () => {
    const res = await client.functions.invoke('');
    expect(res.data).toBeNull();
    expect(res.error).toBeDefined();
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('invokes function and passes body payload and default headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: { tax: 19.25, total: 119.25 },
      }),
    });

    const res = await client.functions.invoke('calculate-tax', {
      body: { amount: 100 },
    });

    expect(res.status).toBe(200);
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ tax: 19.25, total: 119.25 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = mockFetch.mock.calls[0];
    expect(callUrl).toContain('/api/baas/functions/calculate-tax');
    expect(callInit.method).toBe('POST');
    expect(JSON.parse(callInit.body)).toEqual({
      appId: 'test-app-123',
      data: { amount: 100 },
    });
    expect(callInit.headers['X-Nietemo-App-Id']).toBe('test-app-123');
  });

  it('forwards Authorization header when user session exists', async () => {
    // Inject mock session
    (client.auth as any).currentSession = {
      token: 'mock-session-token-xyz',
      user: { id: 'usr_1', email: 'test@flit.site' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: { status: 'processed' } }),
    });

    const res = await client.functions.invoke('process-order');
    expect(res.status).toBe(200);
    const [, callInit] = mockFetch.mock.calls[0];
    expect(callInit.headers['Authorization']).toBe('Bearer mock-session-token-xyz');
  });

  it('handles server errors gracefully without throwing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Database connection failed' }),
    });

    const res = await client.functions.invoke('failing-function');
    expect(res.data).toBeNull();
    expect(res.error).toBeDefined();
    expect(res.error?.message).toContain('Database connection failed');
  });

  it('handles custom request headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: 'ok' }),
    });

    await client.functions.invoke('custom-header-func', {
      headers: { 'X-Custom-Trace': 'trace-123' },
    });

    const [, callInit] = mockFetch.mock.calls[0];
    expect(callInit.headers['X-Custom-Trace']).toBe('trace-123');
  });
});
