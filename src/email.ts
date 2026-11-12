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
   * From the app's browser code the recipient must be the signed-in user (receipts, notifications). To write to
   * anyone else, send the e-mail from a server function with `context.nietemo.email.send`.
   *
   * @example
   * ```typescript
   * await flit.email.send({
   *   to: user.email, // the signed-in user
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
      // From the browser, Nietemo only sends to the signed-in user's own address: it needs their session.
      const sessionToken = this.client.auth.getSession()?.token;
      const res = await this.client.request<SendEmailResponse>('/api/baas/email/send', {
        method: 'POST',
        headers: sessionToken ? { 'X-Nietemo-User-Token': sessionToken } : undefined,
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
