/**
 * Mobile Money & Payment Types
 */

/**
 * Mobile Money operator. Use the plain name ("ORANGE") with `country`, the phone prefix, or a full code
 * such as "ORANGE_CMR". Any other string is passed through and validated by the server.
 */
export type MobileMoneyOperator =
  | 'ORANGE'
  | 'MTN'
  | 'WAVE'
  | 'AIRTEL'
  | 'MOOV'
  | 'MPESA'
  | 'VODACOM_MPESA'
  | 'DJAMO'
  | 'TELECEL'
  | 'AIRTELTIGO'
  | 'CELTIIS'
  | 'MOBICASH'
  | 'FREE'
  | 'EXPRESSO'
  | 'TOGOCOM'
  | 'AFRIMONEY'
  | 'TIGO'
  | 'HALOPESA'
  | 'EZYPESA'
  | 'TTCL'
  | (string & {});

/** Currencies the platform converts from. The charge is made in the payer's country currency. */
export type PaymentCurrency =
  | 'XAF'
  | 'XOF'
  | 'GNF'
  | 'CDF'
  | 'RWF'
  | 'GHS'
  | 'KES'
  | 'UGX'
  | 'TZS'
  | 'SLE'
  | 'USD'
  | 'EUR';

/** Normalized status. `CANCELLED` is kept for sessions cancelled by the customer. */
export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export const FINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = ['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'];

export interface PaymentInitiateRequest {
  /**
   * Mobile Money Operator (Orange Money, MTN MoMo, Wave, etc.)
   */
  operator: MobileMoneyOperator;

  /**
   * Customer phone number (international or national format)
   * Examples: "+237690000000", "690000000", "770000000"
   */
  phone: string;

  /**
   * ISO country of the payer ("CM", "CI"…). Needed when the phone number is local (no dial code) and the
   * operator has no country suffix. Defaults to the country of the dial code, then to Cameroon.
   */
  country?: string;

  /**
   * Amount in specified currency (must be positive)
   */
  amount: number;

  /**
   * Currency of `amount` (default: 'XAF'). Converted to the payer's country currency when different.
   */
  currency?: PaymentCurrency;

  /**
   * Order / Transaction title or memo displayed to customer
   */
  title?: string;

  /**
   * Customer full name
   */
  customerName?: string;

  /**
   * Customer email address
   */
  customerEmail?: string;

  /**
   * Custom metadata payload returned with webhook callbacks
   */
  metadata?: Record<string, any>;
}

/**
 * Hosted checkout (recommended): Swinmo Pay's modal asks the payer for their country, operator and phone
 * number, so the app needs no payment form.
 */
export interface PaymentCheckoutRequest {
  /** Amount in `currency` (default 'XAF'). The payer is debited the equivalent in their own currency. */
  amount: number;
  currency?: PaymentCurrency;
  /** What is being paid, shown in the modal (e.g. "Commande #1042"). */
  title?: string;
  /** ISO country pre-selected in the modal ("CM", "CI"…). The payer can change it. */
  country?: string;
  /** Pre-fills the payer's details when the app already knows them. */
  customer?: { name?: string; email?: string; phone?: string };
  /** Order lines recorded with the payment. */
  items?: Array<Record<string, any>>;
  metadata?: Record<string, any>;
  /** How long to wait for the server confirmation after the modal closes (default 120000 ms). */
  waitTimeoutMs?: number;
}

export interface PaymentCheckoutResult {
  transactionId: string;
  /**
   * SUCCESS: paid and confirmed by the server. PENDING: still being validated by the operator (check later
   * with getStatus). CANCELLED: the payer closed the modal. FAILED / EXPIRED: not paid.
   */
  status: PaymentStatus;
  amount: number;
  currency: string;
  orderId?: string;
  /** "test" payments move no money (unverified creator or app not live). */
  environment?: 'live' | 'test';
  errorMessage?: string;
}

export interface PaymentInitiateResponse {
  success: boolean;
  transactionId: string;
  depositId?: string;
  /** Normalized: the server's PENDING_PIN / COMPLETED are mapped to PENDING / SUCCESS. */
  status: PaymentStatus;
  /** Full operator code, e.g. "ORANGE_CMR". */
  operator: string;
  /** Amount actually charged, in the payer's country currency. */
  amount: number;
  currency: string;
  /** Prompt to show the payer (e.g. "Composez #150*50# pour valider"). */
  instruction?: string;
  /** Present for apps with an order flow. */
  orderId?: string;
  /** "test" charges move no money (unverified creator or app not live). */
  environment?: 'live' | 'test';
  message?: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  transactionId: string;
  status: PaymentStatus;
  operator: string;
  amount: number;
  currency: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  /** Failure reason for payment-widget sessions (same meaning as `errorMessage`). */
  failureReason?: string | null;
  metadata?: Record<string, any>;
}
