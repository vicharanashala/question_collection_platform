import { PayoutMethod, WithdrawalStatus } from '../../classes/enums';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';
import { PaymentLog } from './payment-log.entity';

export interface WithdrawalRequest {
  id: string;

  userId: string;

  walletId: string;

  amount: number;

  payoutMethod: PayoutMethod;

  payoutDetails: Record<string, unknown>;

  status: WithdrawalStatus;

  // PineLabs fields
  pinelabsTransactionId: string | null;

  orderId: string | null;

  /** Razorpay payout ID set after initiating a Razorpay payout */
  razorpayPayoutId: string | null;

  /** UTR number from Razorpay — available once payout is processed/confirmed */
  utrNumber: string | null;

  processedAt: Date | null;

  cancelledAt: Date | null;

  /** Human-readable reason set when a withdrawal fails or is reversed (e.g. bank rejected, payout reversed) */
  failureReason: string | null;

  retryCount: number;

  createdAt: Date;

  user: User;

  wallet: Wallet;

  paymentLogs: PaymentLog[];
}