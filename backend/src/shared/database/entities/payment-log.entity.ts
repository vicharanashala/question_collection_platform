import { PaymentLogStatus } from '../../classes/enums';
import { WithdrawalRequest } from './withdrawal-request.entity';

export interface PaymentLog {
  id: string;

  /** The withdrawal request this log belongs to */
  withdrawalRequestId: string;

  /** Admin who initiated the payment attempt */
  adminId: string | null;

  /** PineLabs order ID (used as idempotency key) */
  orderId: string;

  /** PineLabs transaction ID returned by the API */
  pinelabsTransactionId: string | null;

  /** Razorpay payout ID (set when using Razorpay for disbursement) */
  razorpayPayoutId: string | null;

  /** UTR number returned by Razorpay once the payout is processed */
  utrNumber: string | null;

  status: PaymentLogStatus;

  /** Error code from PineLabs (if failed) */
  errorCode: string | null;

  /** Error message from PineLabs (if failed) */
  errorMessage: string | null;

  /** Raw response from PineLabs (for debugging) */
  rawResponse: Record<string, unknown> | null;

  attemptedAt: Date;

  withdrawalRequest: WithdrawalRequest;
}