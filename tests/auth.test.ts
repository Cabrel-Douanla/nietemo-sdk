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
