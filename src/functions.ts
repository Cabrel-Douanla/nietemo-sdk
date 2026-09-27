import type { NietemoClient } from './client';
import type { InvokeFunctionOptions, FunctionInvokeResponse } from './types/functions';

export class NietemoFunctions {
  private readonly client: NietemoClient;

  constructor(client: NietemoClient) {
    this.client = client;
  }

  /**
   * Invoke a Nietemo Server Function deployed on Nietemo BaaS
   *
   * @param functionName Name of the function to invoke (e.g. 'calculate-tax' or 'generate-pdf')
   * @param options Execution options (body payload, custom headers, timeout)
   *
   * @example
   * ``typescript
   * const { data, error } = await flit.functions.invoke('calculate-tax', {
   *   body: { orderId: 'ord_123' },
   * });
   * if (error) console.error(error.message);
   * else console.log(data);
   * ``
   */
  public async invoke<TData = any, TBody = any>(
    functionName: string,
    options: InvokeFunctionOptions<TBody> = {}
  ): Promise<FunctionInvokeResponse<TData>> {
    if (!functionName || typeof functionName !== 'string') {
      return {
        data: null,
        error: { message: 'Function name must be a valid non-empty string', status: 400 },
        status: 400,
      };
    }

    const cleanName = functionName.trim().replace(/^\/+|\/+$/g, '');

    // Resolve active session token if user is authenticated
    const sessionToken = this.client.auth.getSession()?.token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Nietemo-App-Id': this.client.appId,
      ...(sessionToken ? { Authorization: 'Bearer ' + sessionToken } : {}),
      ...(options.headers || {}),
    };

    try {
      // In browser preview or production, invoke via /api/baas/functions/[name]
      const endpoint = '/api/baas/functions/' + cleanName;
      const functionTimeout = options.timeoutMs ?? (options as any).timeout ?? 60000;
      const res = await this.client.request<{ success?: boolean; data?: TData; error?: string; [key: string]: any }>(
        endpoint,
        {
          method: 'POST',
          headers,
          timeout: functionTimeout,
          body: JSON.stringify({
            appId: this.client.appId,
            data: options.body !== undefined ? options.body : {},
          }),
        }
      );

      // Normalize response
      if (res && res.error) {
        return {
          data: null,
          error: { message: res.error, status: 400, details: res },
          status: 400,
        };
      }

      const returnedData = res && 'data' in res ? (res.data as TData) : (res as unknown as TData);

      return {
        data: returnedData,
        error: null,
        status: 200,
      };
    } catch (err: any) {
      const status = err.status || 500;
      return {
        data: null,
        error: {
          message: err.message || 'Failed to invoke function ' + cleanName,
          status,
          details: err,
        },
        status,
      };
    }
  }
}
