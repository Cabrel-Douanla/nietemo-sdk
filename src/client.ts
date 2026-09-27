import type { NietemoClientOptions, StorageAdapter } from './types/config';
import { NietemoAPIError, NietemoError } from './errors';
import { Collection } from './collection';
import { NietemoPayments } from './payments';
import { NietemoAuth } from './auth';
import { NietemoStorage } from './storage';
import { NietemoEmail } from './email';
import { NietemoFunctions } from './functions';

export class NietemoClient {
  public readonly appId: string;
  public readonly apiKey?: string;
  public readonly endpoint: string;
  public readonly timeout: number;
  private readonly customHeaders: Record<string, string>;
  private readonly customFetch?: typeof globalThis.fetch;
  private readonly debug: boolean;
  private readonly credentials: RequestCredentials;
  private readonly _storageAdapter?: StorageAdapter;

  // Sub-services
  private _payments?: NietemoPayments;
  private _auth?: NietemoAuth;
  private _storage?: NietemoStorage;
  private _email?: NietemoEmail;
  private _functions?: NietemoFunctions;

  constructor(options: NietemoClientOptions) {
    if (!options || !options.appId) {
      throw new NietemoError('appId is required to initialize NietemoClient', 'MISSING_CONFIG');
    }

    this.appId = options.appId.trim();
    this.apiKey = options.apiKey?.trim();

    // Smart default endpoint resolution (detects iframe preview / local dev / production)
    const defaultEndpoint = (() => {
      if (typeof window !== 'undefined') {
        if ((window as any).__NIETEMO_API_URL__ || (window as any).__FLIT_API_URL__) {
          return (window as any).__NIETEMO_API_URL__ || (window as any).__FLIT_API_URL__;
        }
        try {
          const h =
            window.location.hostname ||
            (window.parent && window.parent.location && window.parent.location.hostname) ||
            '';
          if (
            !h ||
            h === 'localhost' ||
            h === '127.0.0.1' ||
            h.endsWith('.local') ||
            h.indexOf('192.168.') === 0 ||
            h.indexOf('10.') === 0
          ) {
            return '';
          }
          const pOrigin = window.parent && window.parent.location && window.parent.location.origin;
          if (pOrigin && !pOrigin.startsWith('about:') && pOrigin !== 'null') {
            return pOrigin;
          }
          const origin = window.location && window.location.origin;
          if (origin && !origin.startsWith('about:') && origin !== 'null') {
            return origin;
          }
        } catch {}
        return '';
      }

      const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
      if (proc && proc.env) {
        if (
          proc.env.NODE_ENV === 'development' ||
          proc.env.NIETEMO_LOCAL === 'true' ||
          proc.env.FLIT_LOCAL === 'true' ||
          !proc.env.NODE_ENV
        ) {
          return (
            proc.env.NEXT_PUBLIC_APP_URL ||
            proc.env.NIETEMO_API_URL ||
            proc.env.FLIT_API_URL ||
            'http://localhost:3000'
          );
        }
      }

      return 'https://api.nietemo.site';
    })();

    let optEndpoint = options.endpoint;
    if (
      optEndpoint &&
      (optEndpoint === 'https://api.flit.site' || optEndpoint === 'http://api.flit.site')
    ) {
      if (defaultEndpoint !== 'https://api.flit.site') {
        optEndpoint = defaultEndpoint;
      }
    }

    this.endpoint = (optEndpoint !== undefined && optEndpoint !== null && optEndpoint !== ''
      ? optEndpoint
      : defaultEndpoint
    ).replace(/\/+$/, '');

    this.timeout = options.timeout || 15000;
    this.customHeaders = options.headers || {};
    this.customFetch = options.fetch;
    this.debug = !!options.debug;
    this.credentials = options.credentials || 'include';
    this._storageAdapter = options.storage;

    // -------------------------------------------------------------------------
    // CRITICAL ANTI-LEAK SECURITY GUARD:
    // Prevent catastrophic leakage of master secret keys into client-side bundles.
    // -------------------------------------------------------------------------
    if (typeof window !== 'undefined' && this.apiKey && this.apiKey.startsWith('flit_sk_')) {
      throw new NietemoError(
        'CRITICAL SECURITY VIOLATION: Nietemo Secret Service Key (flit_sk_...) must NEVER be exposed in client-side browser code! ' +
          'Use your Public Anon Key (flit_pk_...) in frontend applications, and keep Secret Keys strictly on your server.',
        'SECRET_KEY_EXPOSURE'
      );
    }

    if (this.debug) {
      console.log(`[Nietemo SDK] Initialized client for app: ${this.appId} on endpoint: ${this.endpoint}`);
    }
  }

  /**
   * Access a database collection
   * @param name Name of the collection (e.g. 'products', 'users', 'orders')
   */
  public collection<T = any>(name: string): Collection<T> {
    return new Collection<T>(this, name);
  }

  /**
   * Access Mobile Money payments service (Orange Money, MTN MoMo, Wave)
   */
  public get payments(): NietemoPayments {
    if (!this._payments) {
      this._payments = new NietemoPayments(this);
    }
    return this._payments;
  }

  /**
   * Access Authentication service
   */
  public get auth(): NietemoAuth {
    if (!this._auth) {
      this._auth = new NietemoAuth(this, this._storageAdapter);
    }
    return this._auth;
  }

  /**
   * Access Storage & File upload service (Cloudflare R2)
   */
  public get storage(): NietemoStorage {
    if (!this._storage) {
      this._storage = new NietemoStorage(this);
    }
    return this._storage;
  }

  /**
   * Access Transactional Email service (Resend)
   */
  public get email(): NietemoEmail {
    if (!this._email) {
      this._email = new NietemoEmail(this);
    }
    return this._email;
  }

  /**
   * Access Nietemo Server Functions service
   */
  public get functions(): NietemoFunctions {
    if (!this._functions) {
      this._functions = new NietemoFunctions(this);
    }
    return this._functions;
  }

  /**
   * Internal HTTP request transport with timeout and error handling
   */
  public async request<T = any>(
    path: string,
    init: RequestInit & { timeout?: number } = {}
  ): Promise<T> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    let baseEndpoint = this.endpoint;

    if (
      !baseEndpoint ||
      baseEndpoint === 'https://api.flit.site' ||
      baseEndpoint === 'http://api.flit.site'
    ) {
      if (typeof window !== 'undefined') {
        let hostname = '';
        try {
          hostname =
            window.location.hostname ||
            (window.parent && window.parent.location && window.parent.location.hostname) ||
            '';
        } catch {}
        if (
          !hostname ||
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.endsWith('.local') ||
          hostname.indexOf('192.168.') === 0 ||
          hostname.indexOf('10.') === 0
        ) {
          baseEndpoint = (window as any).__FLIT_API_URL__ || '';
        }
      }
    }

    const url = `${baseEndpoint}${cleanPath}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Nietemo-App-Id': this.appId,
      'X-Flit-App-Id': this.appId,
      ...this.customHeaders,
      ...((init.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-Nietemo-Api-Key'] = this.apiKey;
      headers['X-Flit-Api-Key'] = this.apiKey;
    }

    if (init.body && typeof init.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const requestTimeout = init.timeout !== undefined ? init.timeout : this.timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeout);

    const fetchFn = this.customFetch || globalThis.fetch;
    if (typeof fetchFn !== 'function') {
      clearTimeout(timer);
      throw new NietemoError(
        'Global fetch is not available. Provide a custom fetch implementation in NietemoClientOptions.',
        'FETCH_UNAVAILABLE'
      );
    }

    try {
      if (this.debug) {
        console.log(`[Nietemo SDK] ${init.method || 'GET'} ${url}`);
      }

      const response = await fetchFn(url, {
        credentials: this.credentials,
        ...init,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      let data: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { text };
        }
      }

      if (!response.ok) {
        const errorMessage =
          data?.error || data?.message || response.statusText || 'Unknown Server Error';
        throw new NietemoAPIError(
          `[Nietemo API Error ${response.status}]: ${errorMessage}`,
          response.status,
          data?.code || 'HTTP_ERROR',
          data
        );
      }

      return data as T;
    } catch (err: any) {
      clearTimeout(timer);

      if (err instanceof NietemoAPIError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new NietemoAPIError(
          `Request to ${cleanPath} timed out after ${requestTimeout}ms`,
          408,
          'TIMEOUT'
        );
      }

      throw new NietemoError(
        err.message || 'Failed to execute network request to Nietemo API',
        'NETWORK_ERROR'
      );
    }
  }
}

export const FlitClient = NietemoClient;
export type FlitClient = NietemoClient;
