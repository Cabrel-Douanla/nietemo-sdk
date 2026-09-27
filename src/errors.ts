/**
 * Nietemo SDK Error Hierarchy
 */

export class NietemoError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'FLIT_ERROR') {
    super(message);
    this.name = 'NietemoError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NietemoAPIError extends NietemoError {
  public readonly status: number;
  public readonly details?: any;

  constructor(message: string, status: number, code: string = 'API_ERROR', details?: any) {
    super(message, code);
    this.name = 'NietemoAPIError';
    this.status = status;
    this.details = details;
  }
}

export class NietemoPaymentError extends NietemoError {
  public readonly operator?: string;
  public readonly transactionId?: string;

  constructor(message: string, operator?: string, transactionId?: string) {
    super(message, 'PAYMENT_FAILED');
    this.name = 'NietemoPaymentError';
    this.operator = operator;
    this.transactionId = transactionId;
  }
}

export class NietemoAuthError extends NietemoError {
  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message, code);
    this.name = 'NietemoAuthError';
  }
}
