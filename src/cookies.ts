/**
 * Universal Cookie & Cryptographic Utilities
 * In strict compliance with Web Security Standards:
 * - RFC 6265 Cookies with HttpOnly, Secure, and SameSite=Lax flags
 * - AES-256-GCM authenticated symmetric encryption via standard Web Crypto API (crypto.subtle)
 * - Zero XSS vulnerability: Tokens never touch document.cookie or localStorage
 */

export interface CookieOptions {
  name?: string;
  path?: string;
  maxAge?: number; // In seconds (default: 30 days)
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
}

export interface EncryptedSessionPayload {
  token: string;
  userId: string;
  appId: string;
  expiresAt: number;
  [key: string]: any;
}

const DEFAULT_COOKIE_NAME = 'nietemo_session';
const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * Derive a 256-bit CryptoKey from a secret key string using SHA-256
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const secretBytes = enc.encode(secret);
  const hash = await crypto.subtle.digest('SHA-256', secretBytes);

  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a session payload into a compact base64-encoded string using AES-256-GCM
 */
export async function encryptSession(
  payload: EncryptedSessionPayload,
  secretKey: string
): Promise<string> {
  const key = await deriveKey(secretKey);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedPayload
  );

  // Pack: IV (12 bytes) + Ciphertext + Auth Tag into single Uint8Array
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);

  // Convert to URL-safe Base64
  let binary = '';
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decrypt and verify an AES-256-GCM encrypted session string
 */
export async function decryptSession(
  encryptedText: string,
  secretKey: string
): Promise<EncryptedSessionPayload | null> {
  try {
    const key = await deriveKey(secretKey);

    // Decode URL-safe Base64
    let base64 = encryptedText.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }

    if (combined.length < 12 + 16) {
      // Must have at least IV (12 bytes) + Auth Tag (16 bytes)
      return null;
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    const session = JSON.parse(decoded) as EncryptedSessionPayload;

    // Check expiration
    if (session.expiresAt && Date.now() > session.expiresAt) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Build a standard RFC 6265 Set-Cookie header string with HttpOnly and Secure flags
 */
export function buildSetCookieHeader(
  value: string,
  options: CookieOptions = {}
): string {
  const name = options.name || DEFAULT_COOKIE_NAME;
  const path = options.path || '/';
  const maxAge = options.maxAge !== undefined ? options.maxAge : DEFAULT_MAX_AGE;
  const secure = options.secure !== false; // Default true (HTTPS)
  const httpOnly = options.httpOnly !== false; // Default true (XSS immunity)
  const sameSite = options.sameSite || 'Lax';

  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`];

  if (maxAge >= 0) {
    parts.push(`Max-Age=${maxAge}`);
    const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
    parts.push(`Expires=${expires}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (sameSite) {
    parts.push(`SameSite=${sameSite}`);
  }

  if (secure) {
    parts.push('Secure');
  }

  if (httpOnly) {
    parts.push('HttpOnly');
  }

  return parts.join('; ');
}

/**
 * Build a Set-Cookie header to immediately expire and delete the session cookie
 */
export function buildClearCookieHeader(options: CookieOptions = {}): string {
  return buildSetCookieHeader('', {
    ...options,
    maxAge: 0,
  });
}

/**
 * Parse a specific cookie value from an incoming `Cookie` header string
 */
export function parseCookieFromHeader(
  cookieHeader: string | null | undefined,
  cookieName: string = DEFAULT_COOKIE_NAME
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const [key, ...valParts] = c.trim().split('=');
    if (key === cookieName) {
      return decodeURIComponent(valParts.join('='));
    }
  }

  return null;
}
