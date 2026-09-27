/**
 * Nietemo BaaS & Mobile Money SDK
 * Official TypeScript Client Library
 */

import { NietemoClient } from './client';
import type { NietemoClientOptions } from './types/config';

/**
 * Creates and initializes a new Nietemo BaaS Client instance
 *
 * @example
 * ```typescript
 * import { createClient } from 'nietemo';
 *
 * export const flit = createClient({
 *   appId: 'preview-app',
 * });
 *
 * // Query documents
 * const products = await flit.collection('products').find();
 *
 * // Social Auth
 * await flit.auth.signInWithGoogle();
 *
 * // File Upload (Cloudflare R2)
 * const file = await flit.storage.upload(blob, 'avatar.png');
 *
 * // Send Email (Resend)
 * await flit.email.send({ to: 'user@example.com', subject: 'Bienvenue', html: '<h1>Bienvenue !</h1>' });
 *
 * // Initiate Mobile Money payment
 * const payment = await flit.payments.initiate({
 *   operator: 'ORANGE',
 *   phone: '690000000',
 *   amount: 15000,
 * });
 * ```
 */
export function createClient(options: NietemoClientOptions): NietemoClient {
  return new NietemoClient(options);
}

export { NietemoClient } from './client';
export { Collection } from './collection';
export { NietemoPayments } from './payments';
export { NietemoAuth } from './auth';
export { NietemoStorage } from './storage';
export { NietemoEmail } from './email';
export { NietemoFunctions } from './functions';
export * from './cookies';
export * from './errors';
export * from './types';
export default createClient;

// Backward Compatibility Aliases
export { NietemoClient as FlitClient } from './client';
export { NietemoAuth as FlitAuth } from './auth';
export { NietemoPayments as FlitPayments } from './payments';
export { NietemoStorage as FlitStorage } from './storage';
export { NietemoEmail as FlitEmail } from './email';
export { NietemoFunctions as FlitFunctions } from './functions';
export { NietemoError as FlitError, NietemoAPIError as FlitAPIError, NietemoAuthError as FlitAuthError, NietemoPaymentError as FlitPaymentError } from './errors';
export type { NietemoClientOptions as FlitClientOptions } from './types/config';
