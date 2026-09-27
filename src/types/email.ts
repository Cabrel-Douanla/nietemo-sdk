/**
 * Transactional Email Types & Interfaces
 */

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResponse {
  success: boolean;
  id?: string;
  devMode?: boolean;
  message?: string;
  error?: string;
}
