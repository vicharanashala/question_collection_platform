import axios, { HttpStatusCode } from 'axios';

// Categories of SMS delivery failure that are safe to expose to API clients.
export enum SmsFailureReason {
  NOT_CONFIGURED = 'SMS_GATEWAY_NOT_CONFIGURED',
  AUTH_FAILED = 'SMS_GATEWAY_AUTH_FAILED',
  REJECTED = 'SMS_GATEWAY_REJECTED',
  TIMEOUT = 'SMS_GATEWAY_TIMEOUT',
  UNREACHABLE = 'SMS_GATEWAY_UNREACHABLE',
  GATEWAY_ERROR = 'SMS_GATEWAY_ERROR',
  UNKNOWN = 'UNKNOWN',
}

interface SmsFailureInfo {
  description: string;
  retryable: boolean;
}

// User-safe description and retry hint for each failure category.
export const SMS_FAILURE_INFO: Record<SmsFailureReason, SmsFailureInfo> = {
  [SmsFailureReason.NOT_CONFIGURED]: {
    description: 'The SMS service is not configured on the server.',
    retryable: false,
  },
  [SmsFailureReason.AUTH_FAILED]: {
    description: 'The server could not authenticate with the SMS provider.',
    retryable: false,
  },
  [SmsFailureReason.REJECTED]: {
    description:
      'The SMS provider rejected the message. The mobile number may be invalid, inactive or on a do not disturb list.',
    retryable: false,
  },
  [SmsFailureReason.TIMEOUT]: {
    description: 'The SMS provider did not respond in time.',
    retryable: true,
  },
  [SmsFailureReason.UNREACHABLE]: {
    description: 'The server could not reach the SMS provider.',
    retryable: true,
  },
  [SmsFailureReason.GATEWAY_ERROR]: {
    description: 'The SMS provider is temporarily unavailable.',
    retryable: true,
  },
  [SmsFailureReason.UNKNOWN]: {
    description: 'An unexpected error occurred while sending the SMS.',
    retryable: true,
  },
};

const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

/**
 * Error thrown by SMS providers. The message holds the secret-free gateway detail
 * for logs, and `reason` holds the category that is safe to return to clients.
 */
export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    readonly reason: SmsFailureReason,
  ) {
    super(message);
    this.name = 'SmsDeliveryError';
  }
}

// Maps any provider error (axios, SmsDeliveryError or other) to a failure category.
export function classifySmsError(err: unknown): SmsFailureReason {
  if (err instanceof SmsDeliveryError) return err.reason;
  if (!axios.isAxiosError(err)) return SmsFailureReason.UNKNOWN;

  const status = err.response?.status;
  if (status === undefined) {
    return err.code && TIMEOUT_CODES.has(err.code)
      ? SmsFailureReason.TIMEOUT
      : SmsFailureReason.UNREACHABLE;
  }
  if (status === HttpStatusCode.Unauthorized || status === HttpStatusCode.Forbidden) {
    return SmsFailureReason.AUTH_FAILED;
  }
  if (status === HttpStatusCode.RequestTimeout || status === HttpStatusCode.GatewayTimeout) {
    return SmsFailureReason.TIMEOUT;
  }
  return status >= 500 ? SmsFailureReason.GATEWAY_ERROR : SmsFailureReason.REJECTED;
}
