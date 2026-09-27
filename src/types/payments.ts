/**
 * Mobile Money & Payment Types
 */

export type MobileMoneyOperator =
  | 'ORANGE'
  | 'MTN'
  | 'WAVE'
  | 'AIRTEL'
  | 'MOOV'
  | 'MPESA';

export type PaymentCurrency =
  | 'XAF'
  | 'XOF'
  | 'KES'
  | 'GHS'
  | 'USD';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface PaymentInitiateRequest {
  /**
   * Mobile Money Operator (Orange Money, MTN MoMo, Wave, etc.)
   */
  operator: MobileMoneyOperator;

  /**
   * Recipient / Customer phone number (international or national format)
   * Examples: "+237690000000", "690000000", "770000000"
   */
  phone: string;

  /**
   * Amount in specified currency (must be positive integer or decimal)
   */
  amount: number;

  /**
   * Regional Currency (default: 'XAF')
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

export interface PaymentInitiateResponse {
  success: boolean;
  transactionId: string;
  depositId?: string;
  status: PaymentStatus;
  operator: MobileMoneyOperator;
  amount: number;
  currency: PaymentCurrency;
  message?: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  transactionId: string;
  status: PaymentStatus;
  operator: MobileMoneyOperator;
  amount: number;
  currency: PaymentCurrency;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}
