import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, NietemoClient } from '../src';

describe('Nietemo BaaS Expansion (OAuth, Resend, Cloudflare R2)', () => {
  let client: NietemoClient;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = createClient({
      appId: 'test-app-123',
      fetch: mockFetch,
    });
  });

  describe('Social OAuth', () => {
    it('provides shortcuts for Google, Apple, Microsoft, and GitHub', () => {
      expect(typeof client.auth.signInWithGoogle).toBe('function');
      expect(typeof client.auth.signInWithApple).toBe('function');
      expect(typeof client.auth.signInWithMicrosoft).toBe('function');
      expect(typeof client.auth.signInWithGithub).toBe('function');
      expect(typeof client.auth.signInWithOAuth).toBe('function');
    });
  });

  describe('Email & Password Auth flows', () => {
    it('sends password reset email', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, message: 'Reset email sent' }),
      });

      const res = await client.auth.sendPasswordResetEmail('user@test.com');
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/baas/auth/password-reset'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('confirms password reset', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, message: 'Password updated' }),
      });

      const res = await client.auth.resetPassword({
        email: 'user@test.com',
        code: '123456',
        newPassword: 'new-secret-password',
      });
      expect(res.success).toBe(true);
    });

    it('sends and verifies email verification codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, message: 'Verification code sent' }),
      });

      const sendRes = await client.auth.sendVerificationEmail('user@test.com');
      expect(sendRes.success).toBe(true);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, message: 'Email verified' }),
      });

      const verifyRes = await client.auth.verifyEmail({
        email: 'user@test.com',
        code: '654321',
      });
      expect(verifyRes.success).toBe(true);
    });

    it('sends and verifies magic links', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, message: 'Magic link sent' }),
      });

      const sendRes = await client.auth.signInWithMagicLink('user@test.com');
      expect(sendRes.success).toBe(true);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          token: 'flit_auth_test_123',
          session: {
            token: 'flit_auth_test_123',
            user: { id: 'u1', email: 'user@test.com', createdAt: '2026-09-13' },
            expiresAt: Date.now() + 10000,
          },
        }),
      });

      const verifyRes = await client.auth.verifyMagicLink('magic_token_abc');
      expect(verifyRes.success).toBe(true);
      expect(client.auth.getUser()?.email).toBe('user@test.com');
    });
  });

  describe('Storage via Cloudflare R2', () => {
    it('deletes stored assets by key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      });

      const deleted = await client.storage.delete('apps/test-app-123/doc.pdf');
      expect(deleted).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/baas/storage'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('lists stored assets for this app', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          files: [
            {
              id: 'f1',
              key: 'apps/test-app-123/img.png',
              fileName: 'img.png',
              size: 2048,
              mimeType: 'image/png',
              publicUrl: 'https://assets.flit.site/img.png',
              provider: 'CLOUDFLARE_R2',
              createdAt: '2026-09-13',
            },
          ],
        }),
      });

      const files = await client.storage.listFiles({ limit: 10 });
      expect(files).toHaveLength(1);
      expect(files[0].key).toBe('apps/test-app-123/img.png');
    });

    it('retrieves presigned download URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          downloadUrl: 'https://flit-storage.r2.cloudflarestorage.com/signed-url',
        }),
      });

      const url = await client.storage.getDownloadUrl('apps/test-app-123/contract.pdf');
      expect(url).toContain('signed-url');
    });
  });

  describe('Transactional Email (Resend)', () => {
    it('dispatches emails via client.email.send', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, id: 'resend_email_123' }),
      });

      const res = await client.email.send({
        to: 'buyer@example.com',
        subject: 'Votre facture #1024',
        html: '<p>Merci pour votre commande !</p>',
      });

      expect(res.success).toBe(true);
      expect(res.id).toBe('resend_email_123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/baas/email/send'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
