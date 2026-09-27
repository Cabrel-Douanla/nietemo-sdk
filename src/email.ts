import type { NietemoClient } from './client';
import type { SendEmailParams, SendEmailResponse } from './types/email';
import { NietemoError } from './errors';

export class NietemoEmail {
  private readonly client: NietemoClient;

  constructor(client: NietemoClient) {
    this.client = client;
  }

  /**
   * Send a transactional email via Nietemo BaaS (Resend)
   *
   * @example
   * ```typescript
   * await flit.email.send({
   *   to: 'client@example.com',
   *   subject: 'Confirmation de commande',
   *   html: '<h1>Merci pour votre achat !</h1>',
   * });
   * ```
   */
  public async send(options: SendEmailParams): Promise<SendEmailResponse> {
    if (!options.to || !options.subject || (!options.html && !options.text)) {
      throw new NietemoError(
        'Missing required parameters: "to", "subject", and ("html" or "text") are mandatory.',
        'INVALID_PARAMS'
      );
    }

    try {
      const res = await this.client.request<SendEmailResponse>('/api/baas/email/send', {
        method: 'POST',
        body: JSON.stringify({
          appId: this.client.appId,
          ...options,
        }),
      });
      return res;
    } catch (err: any) {
      throw new NietemoError(err.message || 'Failed to send email via Nietemo BaaS', 'EMAIL_ERROR');
    }
  }
}
