import type { NietemoUser } from './auth';

/**
 * Options for invoking a Nietemo Server Function
 */
export interface InvokeFunctionOptions<TBody = any> {
  /** Request body payload sent to the function */
  body?: TBody;
  /** Custom request headers forwarded to the function */
  headers?: Record<string, string>;
  /** Optional custom timeout in milliseconds (default: 60000ms) */
  timeoutMs?: number;
  /** Alias for timeoutMs */
  timeout?: number;
}

/**
 * Response received after invoking a Nietemo Server Function
 */
export interface FunctionInvokeResponse<TData = any> {
  /** Data returned by the function handler on success */
  data: TData | null;
  /** Error object if the execution failed */
  error: { message: string; status?: number; details?: any } | null;
  /** HTTP status code */
  status: number;
}

/**
 * Server execution context passed to a Nietemo Server Function
 */
export interface NietemoFunctionContext<TData = any> {
  /** Payload / body sent by the caller */
  data: TData;
  /** Authenticated user making the call (if signed in) */
  user: NietemoUser | null;
  /** Decrypted server environment variables and Vault secrets */
  env: Record<string, string>;
  /** Server Nietemo BaaS client with admin Service Role privileges */
  flit: any;
  /** Request metadata (headers, IP, origin) */
  request: {
    headers: Record<string, string>;
    method: string;
    url: string;
  };
}

/**
 * Handler function signature for a Nietemo Server Function
 */
export type NietemoFunctionHandler<TData = any, TResult = any> = (
  context: NietemoFunctionContext<TData>
) => Promise<TResult> | TResult;
