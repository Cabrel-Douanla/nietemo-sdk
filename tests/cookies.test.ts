import { describe, it, expect } from 'vitest';
import {
  encryptSession,
  decryptSession,
  buildSetCookieHeader,
  buildClearCookieHeader,
  parseCookieFromHeader,
  createClient,
} from '../src';

describe('HttpOnly Encrypted Cookie Management', () => {
  const secretKey = 'test_master_secret_encryption_key_32bytes_long!';

  it('should encrypt and decrypt session payload via AES-256-GCM', async () => {
    const payload = {
      token: 'jwt_secret_token_xyz',
      userId: 'usr_888',
      appId: 'app_test_1',
      expiresAt: Date.now() + 3600000,
    };

    const encrypted = await encryptSession(payload, secretKey);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain(payload.token); // Plaintext token is never visible

    const decrypted = await decryptSession(encrypted, secretKey);
    expect(decrypted).not.toBeNull();
    expect(decrypted?.token).toBe('jwt_secret_token_xyz');
    expect(decrypted?.userId).toBe('usr_888');
  });

  it('should fail decryption if wrong secret key is used or ciphertext is tampered', async () => {
    const payload = {
      token: 'jwt_secure',
      userId: 'usr_1',
      appId: 'app_1',
      expiresAt: Date.now() + 10000,
    };

    const encrypted = await encryptSession(payload, secretKey);

    // Wrong key
    const wrongDecrypted = await decryptSession(encrypted, 'completely_wrong_key!');
    expect(wrongDecrypted).toBeNull();

    // Tampered payload
    const tampered = encrypted.slice(0, -4) + 'AAAA';
    const tamperedDecrypted = await decryptSession(tampered, secretKey);
    expect(tamperedDecrypted).toBeNull();
  });

  it('should return null if decrypted session is expired', async () => {
    const expiredPayload = {
      token: 'jwt_expired',
      userId: 'usr_old',
      appId: 'app_1',
      expiresAt: Date.now() - 10000, // expired in past
    };

    const encrypted = await encryptSession(expiredPayload, secretKey);
    const decrypted = await decryptSession(encrypted, secretKey);
    expect(decrypted).toBeNull();
  });

  it('should build Set-Cookie header with HttpOnly, Secure, and SameSite=Lax flags', () => {
    const header = buildSetCookieHeader('encrypted_token_value', {
      name: 'nietemo_session',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    });

    expect(header).toContain('nietemo_session=encrypted_token_value');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
  });

  it('should build Clear Cookie header with Max-Age=0', () => {
    const header = buildClearCookieHeader({ name: 'nietemo_session' });
    expect(header).toContain('nietemo_session=');
    expect(header).toContain('Max-Age=0');
    expect(header).toContain('HttpOnly');
  });

  it('should parse cookie value from incoming Cookie header', () => {
    const cookieHeader = 'theme=dark; nietemo_session=my_encrypted_session_data; lang=fr';
    const parsed = parseCookieFromHeader(cookieHeader, 'nietemo_session');
    expect(parsed).toBe('my_encrypted_session_data');
  });

  it('should verify session via flit.auth.createSessionCookie & flit.auth.verifySessionCookie', async () => {
    const client = createClient({ appId: 'app_999', apiKey: 'flit_sk_server_key' });

    const session = {
      token: 'jwt_live_session',
      expiresAt: Date.now() + 3600000,
      user: {
        id: 'usr_xyz',
        email: 'ceo@african-startup.com',
        createdAt: '2026-01-01',
      },
    };

    const cookieString = await client.auth.createSessionCookie(session);
    expect(cookieString).toContain('nietemo_session=');
    expect(cookieString).toContain('HttpOnly');

    // Extract cookie value to simulate incoming request header
    const rawVal = cookieString.split(';')[0].split('=')[1];
    const incomingHeader = `nietemo_session=${rawVal}`;

    const verified = await client.auth.verifySessionCookie(incomingHeader);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('usr_xyz');
    expect(verified?.email).toBe('ceo@african-startup.com');
  });
});
