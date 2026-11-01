import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../src';
import type { StorageAdapter } from '../src';

describe('NietemoClient Auth Security & In-Memory Storage', () => {
  it('should manage sessions in-memory by default without touching localStorage', async () => {
    const mockSession = {
      token: 'jwt_test_token_123',
      expiresAt: Date.now() + 3600000,
      user: {
        id: 'usr_1',
        email: 'user@test.com',
        createdAt: '2026-01-01T00:00:00Z',
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        session: mockSession,
        user: mockSession.user,
      }),
    });

    const client = createClient({ appId: 'app_123', fetch: mockFetch });

    // Ensure session is initially null
    expect(client.auth.getSession()).toBeNull();
    expect(client.auth.getUser()).toBeNull();

    // Sign in
    await client.auth.signInWithPassword({
      email: 'user@test.com',
      password: 'password123',
    });

    // Session is now stored safely in-memory
    expect(client.auth.getSession()?.token).toBe('jwt_test_token_123');
    expect(client.auth.getUser()?.email).toBe('user@test.com');

    // Sign out clears memory
    await client.auth.signOut();
    expect(client.auth.getSession()).toBeNull();
    expect(client.auth.getUser()).toBeNull();
  });

  it('should support custom StorageAdapter when explicitly provided', async () => {
    const store = new Map<string, string>();
    const customAdapter: StorageAdapter = {
      getItem: vi.fn((k) => store.get(k) || null),
      setItem: vi.fn((k, v) => store.set(k, v)),
      removeItem: vi.fn((k) => store.delete(k)),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        session: {
          token: 'token_custom',
          expiresAt: Date.now() + 3600,
          user: { id: 'u_1', email: 'custom@test.com', createdAt: '2026-01-01' },
        },
      }),
    });

    const client = createClient({
      appId: 'app_123',
      storage: customAdapter,
      fetch: mockFetch,
    });

    await client.auth.signInWithPassword({ email: 'custom@test.com', password: 'pass' });

    expect(customAdapter.setItem).toHaveBeenCalledTimes(1);
    expect(store.has('nietemo_auth_session_app_123')).toBe(true);

    await client.auth.signOut();
    expect(customAdapter.removeItem).toHaveBeenCalledTimes(1);
    expect(store.has('nietemo_auth_session_app_123')).toBe(false);
  });
});

describe('Password confirmation and change', () => {
  const session = { token: 'tok_1', expiresAt: Date.now() + 3600000, user: { id: 'u1', email: 'a@b.co', createdAt: '' } };
  const okFetch = () =>
    vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, session, user: session.user, message: 'ok' }),
    });

  it('signUp refuses mismatching confirmPassword before any request', async () => {
    const fetch = okFetch();
    const client = createClient({ appId: 'app_1', fetch });
    await expect(
      client.auth.signUp({ email: 'a@b.co', password: 'longpassword', confirmPassword: 'different1' })
    ).rejects.toThrow('Passwords do not match');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('changePassword sends the session token and both passwords', async () => {
    const fetch = okFetch();
    const client = createClient({ appId: 'app_1', fetch });
    await client.auth.signInWithPassword({ email: 'a@b.co', password: 'longpassword' });
    fetch.mockClear();

    await client.auth.changePassword({ currentPassword: 'longpassword', newPassword: 'another-long-one' });

    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toContain('/api/baas/auth/change-password');
    expect(init.headers.Authorization).toBe('Bearer tok_1');
    expect(JSON.parse(init.body)).toMatchObject({ currentPassword: 'longpassword', newPassword: 'another-long-one' });
  });

  it('changePassword requires a signed-in user and matching confirmation', async () => {
    const client = createClient({ appId: 'app_1', fetch: okFetch() });
    await expect(client.auth.changePassword({ currentPassword: 'a', newPassword: 'b' })).rejects.toThrow('signed in');
    await client.auth.signInWithPassword({ email: 'a@b.co', password: 'longpassword' });
    await expect(
      client.auth.changePassword({ currentPassword: 'a', newPassword: 'b1234567', confirmPassword: 'c1234567' })
    ).rejects.toThrow('Passwords do not match');
  });
});
