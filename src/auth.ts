import type { NietemoClient } from './client';
import type { StorageAdapter } from './types/config';
import type {
  AuthResponse,
  AuthSession,
  AuthUser,
  SignInCredentials,
  SignUpCredentials,
  SignInWithOAuthOptions,
  PasswordResetConfirmOptions,
  VerifyEmailOptions,
  MagicLinkOptions,
  AuthActionResponse,
} from './types/auth';
import {
  buildSetCookieHeader,
  buildClearCookieHeader,
  parseCookieFromHeader,
  encryptSession,
  decryptSession,
  type CookieOptions,
  type EncryptedSessionPayload,
} from './cookies';
import { NietemoAuthError } from './errors';

export class NietemoAuth {
  private readonly client: NietemoClient;
  private readonly storage?: StorageAdapter;
  private currentSession: AuthSession | null = null;
  private readonly storageKey: string;

  constructor(client: NietemoClient, storage?: StorageAdapter) {
    this.client = client;
    this.storage = storage;
    this.storageKey = `nietemo_auth_session_${this.client.appId}`;
    this.initSession();
  }

  /**
   * Initialize session securely.
   * If a custom storage adapter was provided (e.g. secure encrypted cookie store),
   * load the session from it. Otherwise check memory or URL fragment from OAuth redirects.
   */
  private async initSession(): Promise<void> {
    // 1. Check if returning from Social OAuth redirect with token in URL hash
    if (typeof window !== 'undefined' && window.location && window.location.hash) {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get('token');
        const sessionRaw = params.get('session');

        if (token && sessionRaw) {
          const session = JSON.parse(decodeURIComponent(sessionRaw));
          await this.persistSession(session);
          // Clean up hash from URL without page reload
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.pathname + window.location.search;
            window.history.replaceState(null, '', cleanUrl);
          }
          return;
        }
      } catch (e) {
        console.warn('[NietemoAuth] Error hydrating session from URL hash:', e);
      }
    }

    // 2. Load from storage adapter or localStorage fallback
    if (this.storage) {
      try {
        const stored = await this.storage.getItem(this.storageKey);
        if (stored) {
          this.currentSession = JSON.parse(stored);
        }
      } catch {}
    } else if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          this.currentSession = JSON.parse(stored);
        }
      } catch {}
    }
  }

  private async persistSession(session: AuthSession | null): Promise<void> {
    this.currentSession = session;
    if (this.storage) {
      try {
        if (session) {
          await this.storage.setItem(this.storageKey, JSON.stringify(session));
        } else {
          await this.storage.removeItem(this.storageKey);
        }
      } catch {}
    } else if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (session) {
          window.localStorage.setItem(this.storageKey, JSON.stringify(session));
          window.localStorage.setItem('nietemo_auth_token', session.token);
        } else {
          window.localStorage.removeItem(this.storageKey);
          window.localStorage.removeItem('nietemo_auth_token');
        }
      } catch {}
    }
  }

  /**
   * Register a new user with email and password
   */
  public async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    if (!credentials.email) {
      throw new NietemoAuthError('Email is required for registration');
    }

    try {
      const res = await this.client.request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          appId: this.client.appId,
          ...credentials,
        }),
      });

      if (res.session) {
        await this.persistSession(res.session);
      }

      return res;
    } catch (err: any) {
      throw new NietemoAuthError(err.message || 'Registration failed');
    }
  }

  /**
   * Universal register method (supports object or positional arguments)
   */
  public async register(
    credentialsOrEmail: SignUpCredentials | string,
    password?: string,
    name?: string
  ): Promise<AuthResponse> {
    const creds: SignUpCredentials =
      typeof credentialsOrEmail === 'string'
        ? { email: credentialsOrEmail, password, name }
        : credentialsOrEmail || { email: '' };
    return this.signUp(creds);
  }

  /**
   * Sign in an existing user with email and password
   */
  public async signInWithPassword(credentials: SignInCredentials): Promise<AuthResponse> {
    if (!credentials.email || !credentials.password) {
      throw new NietemoAuthError('Email and password are required');
    }

    try {
      const res = await this.client.request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          appId: this.client.appId,
          ...credentials,
        }),
      });

      if (res.session) {
        await this.persistSession(res.session);
      }

      return res;
    } catch (err: any) {
      throw new NietemoAuthError(err.message || 'Authentication failed');
    }
  }

  /**
   * Universal sign in method (supports object or positional arguments)
   */
  public async signIn(
    credentialsOrEmail: SignInCredentials | string,
    password?: string
  ): Promise<AuthResponse> {
    const creds: SignInCredentials =
      typeof credentialsOrEmail === 'string'
        ? { email: credentialsOrEmail, password }
        : credentialsOrEmail || { email: '' };
    return this.signInWithPassword(creds);
  }

  /**
   * Login alias for signIn
   */
  public async login(
    credentialsOrEmail: SignInCredentials | string,
    password?: string
  ): Promise<AuthResponse> {
    return this.signIn(credentialsOrEmail as any, password);
  }

  /**
   * Social OAuth Authentication (Google, Apple, Microsoft, GitHub)
   * Supports both non-blocking popup mode and full redirect mode.
   */
  public async signInWithOAuth(options: SignInWithOAuthOptions): Promise<AuthResponse> {
    const provider = options.provider.toLowerCase();
    const isBrowser = typeof window !== 'undefined';
    const isPopup = options.popup !== false && isBrowser;
    const redirectTo = options.redirectTo || (isBrowser ? window.location.href : '/');

    const oauthUrl = `${this.client.endpoint}/api/baas/auth/oauth/${provider}?appId=${encodeURIComponent(
      this.client.appId
    )}&redirectTo=${encodeURIComponent(redirectTo)}&popup=${isPopup}`;

    if (!isBrowser) {
      throw new NietemoAuthError('OAuth authentication must be executed in a browser environment');
    }

    if (isPopup) {
      return new Promise<AuthResponse>((resolve, reject) => {
        const width = 500;
        const height = 620;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popupWindow = window.open(
          oauthUrl,
          `Nietemo_OAuth_${provider}`,
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
        );

        if (!popupWindow) {
          // Popup blocked, fall back to redirect
          window.location.href = oauthUrl;
          return;
        }

        const handleMessage = async (event: MessageEvent) => {
          if (event.data && event.data.type === 'FLIT_OAUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage);
            clearInterval(pollTimer);
            const { session, user, token } = event.data;
            if (session) {
              await this.persistSession(session);
            }
            resolve({
              success: true,
              session,
              user,
              token,
            });
          }
        };

        window.addEventListener('message', handleMessage);

        const pollTimer = setInterval(() => {
          if (popupWindow.closed) {
            clearInterval(pollTimer);
            window.removeEventListener('message', handleMessage);
            if (this.currentSession) {
              resolve({
                success: true,
                session: this.currentSession,
                user: this.currentSession.user,
                token: this.currentSession.token,
              });
            } else {
              reject(new NietemoAuthError('OAuth window was closed before completion'));
            }
          }
        }, 1000);
      });
    }

    // Redirect mode
    window.location.href = oauthUrl;
    return { success: true };
  }

  /**
   * Sign in with Google (OAuth)
   */
  public async signInWithGoogle(options?: { redirectTo?: string; popup?: boolean }): Promise<AuthResponse> {
    return this.signInWithOAuth({ provider: 'google', ...options });
  }

  /**
   * Sign in with Apple (OAuth)
   */
  public async signInWithApple(options?: { redirectTo?: string; popup?: boolean }): Promise<AuthResponse> {
    return this.signInWithOAuth({ provider: 'apple', ...options });
  }

  /**
   * Sign in with Microsoft (OAuth)
   */
  public async signInWithMicrosoft(options?: { redirectTo?: string; popup?: boolean }): Promise<AuthResponse> {
    return this.signInWithOAuth({ provider: 'microsoft', ...options });
  }

  /**
   * Sign in with GitHub (OAuth)
   */
  public async signInWithGithub(options?: { redirectTo?: string; popup?: boolean }): Promise<AuthResponse> {
    return this.signInWithOAuth({ provider: 'github', ...options });
  }

  /**
   * Send a password reset email via Resend
   */
  public async sendPasswordResetEmail(email: string): Promise<AuthActionResponse> {
    if (!email) {
      throw new NietemoAuthError('Email is required for password reset');
    }

    return this.client.request<AuthActionResponse>('/api/baas/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({
        appId: this.client.appId,
        action: 'request',
        email,
      }),
    });
  }

  /**
   * Confirm password reset with token or 6-digit code and set new password
   */
  public async resetPassword(options: PasswordResetConfirmOptions): Promise<AuthActionResponse> {
    if (!options.email || !options.newPassword || (!options.token && !options.code)) {
      throw new NietemoAuthError('Email, token/code, and newPassword are required');
    }

    return this.client.request<AuthActionResponse>('/api/baas/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({
        appId: this.client.appId,
        action: 'confirm',
        ...options,
      }),
    });
  }

  /**
   * Send email verification link & code via Resend
   */
  public async sendVerificationEmail(email: string): Promise<AuthActionResponse> {
    if (!email) {
      throw new NietemoAuthError('Email is required to send verification');
    }

    return this.client.request<AuthActionResponse>('/api/baas/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        appId: this.client.appId,
        action: 'send',
        email,
      }),
    });
  }

  /**
   * Verify user's email address with token or 6-digit code
   */
  public async verifyEmail(options: VerifyEmailOptions): Promise<AuthActionResponse> {
    if (!options.email || (!options.token && !options.code)) {
      throw new NietemoAuthError('Email and token/code are required for verification');
    }

    return this.client.request<AuthActionResponse>('/api/baas/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        appId: this.client.appId,
        action: 'verify',
        ...options,
      }),
    });
  }

  /**
   * Send passwordless magic link via email
   */
  public async signInWithMagicLink(
    email: string,
    options?: MagicLinkOptions
  ): Promise<AuthActionResponse> {
    if (!email) {
      throw new NietemoAuthError('Email is required for magic link sign in');
    }

    return this.client.request<AuthActionResponse>('/api/baas/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({
        appId: this.client.appId,
        action: 'send',
        email,
        ...options,
      }),
    });
  }

  /**
   * Verify magic link token and log in
   */
  public async verifyMagicLink(token: string): Promise<AuthResponse> {
    if (!token) {
      throw new NietemoAuthError('Token is required for magic link verification');
    }

    const res = await this.client.request<AuthResponse>('/api/baas/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({
        appId: this.client.appId,
        action: 'verify',
        token,
      }),
    });

    if (res.session) {
      await this.persistSession(res.session);
    }

    return res;
  }

  /**
   * Sign out the currently authenticated user
   */
  public async signOut(): Promise<void> {
    await this.persistSession(null);
  }

  /**
   * Logout alias for signOut
   */
  public async logout(): Promise<void> {
    return this.signOut();
  }

  /**
   * Get current session if available (synchronous)
   */
  public getSession(): AuthSession | null {
    return this.currentSession;
  }

  /**
   * Get current user if authenticated (synchronous)
   */
  public getUser(): AuthUser | null {
    return this.currentSession?.user || null;
  }

  /**
   * Server-Side Helper: Generate a cryptographically encrypted (AES-256-GCM) HttpOnly Set-Cookie header.
   */
  public async createSessionCookie(
    session: AuthSession,
    secretKey?: string,
    options?: CookieOptions
  ): Promise<string> {
    const key = secretKey || this.client.apiKey || this.client.appId;
    const payload: EncryptedSessionPayload = {
      token: session.token,
      userId: session.user.id,
      appId: this.client.appId,
      expiresAt: session.expiresAt,
      email: session.user.email,
    };

    const encrypted = await encryptSession(payload, key);
    return buildSetCookieHeader(encrypted, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      ...options,
    });
  }

  /**
   * Server-Side Helper: Decrypt and verify an incoming HttpOnly cookie header using AES-256-GCM.
   */
  public async verifySessionCookie(
    cookieHeader: string | null | undefined,
    secretKey?: string,
    cookieName?: string
  ): Promise<EncryptedSessionPayload | null> {
    const raw = parseCookieFromHeader(cookieHeader, cookieName);
    if (!raw) return null;

    const key = secretKey || this.client.apiKey || this.client.appId;
    return decryptSession(raw, key);
  }

  /**
   * Server-Side Helper: Generate a Set-Cookie header that expires and destroys the session cookie.
   */
  public clearSessionCookie(options?: CookieOptions): string {
    return buildClearCookieHeader({
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      ...options,
    });
  }
}
