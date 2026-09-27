/**
 * Pluggable Storage Adapter for session persistence.
 * By default, Nietemo SDK stores sessions strictly in-memory to prevent XSS localStorage leaks.
 */
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/**
 * Nietemo SDK Configuration Options
 */
export interface NietemoClientOptions {
  /**
   * Unique Application ID provided by Nietemo
   */
  appId: string;

  /**
   * Public Anon Key (flit_pk_...) or Secret Service Key (flit_sk_...)
   * Note: Secret keys (flit_sk_...) are strictly rejected in browser environments for security.
   */
  apiKey?: string;

  /**
   * Base API endpoint (defaults to https://api.flit.site)
   */
  endpoint?: string;

  /**
   * Request timeout in milliseconds (default: 15000ms)
   */
  timeout?: number;

  /**
   * Custom HTTP headers injected into every request
   */
  headers?: Record<string, string>;

  /**
   * Custom storage adapter for auth sessions.
   * Defaults to secure in-memory storage (zero localStorage usage to prevent XSS attacks).
   */
  storage?: StorageAdapter;

  /**
   * Request credentials mode ('include', 'same-origin', 'omit').
   * Defaults to 'include' to automatically forward HttpOnly session cookies.
   */
  credentials?: RequestCredentials;

  /**
   * Custom fetch implementation (useful for testing or specific edge environments)
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Enable verbose console logging for development
   */
  debug?: boolean;
}
