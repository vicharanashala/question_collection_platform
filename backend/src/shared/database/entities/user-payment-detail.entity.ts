import { PayoutMethod } from '../../classes/enums';

export interface UserPaymentDetail {
  id: string;

  userId: string;

  payoutMethod: PayoutMethod;

  /**
   * For UPI: the UPI ID string (e.g. "user@upi").
   * Stored in plain text for display purposes only — never logged or exposed
   * beyond the owning user and admin users.
   */
  upiId: string | null;

  /**
   * For bank: last 4 digits only — stored for display so user recognises the account.
   */
  accountNumberLast4: string | null;

  /**
   * For bank: IFSC code.
   */
  ifsc: string | null;

  ifscEncrypted: string | null;

  /**
   * For bank: account holder name as per bank records.
   */
  accountHolderName: string | null;

  accountHolderNameEncrypted: string | null;

  /**
   * For bank: bank name looked up from IFSC (can be pre-filled or edited by user).
   * Stored in plain text for display.
   */
  bankName: string | null;

  /**
   * The full account number stored encrypted.
   * Only decrypted in-memory when dispatching payouts; never logged or returned in APIs.
   */
  accountNumberEncrypted: string | null;

  /**
   * Verification status — starts pending, becomes verified or failed.
   */
  status: 'pending' | 'in_progress' | 'verified' | 'failed';

  /**
   * The PineLabs order ID used for the verification micro-transaction (deprecated).
   */
  verificationOrderId: string | null;

  /**
   * Reference to the withdrawal request that triggered this verification (if any).
   * Used to link verification -> withdrawal flow.
   */
  withdrawalRequestId: string | null;

  verificationFailedReason: string | null;

  verifiedAt: Date | null;

  /** Razorpay fund_account ID — created once per user, reused for all future payouts */
  razorpayFundAccountId: string | null;

  /** Razorpay payout ID for the most recent payout */
  razorpayPayoutId: string | null;

  /** Razorpay payment link ID for the latest verification collection (deprecated — use fund account validation) */
  razorpayPaymentLinkId: string | null;

  /** Razorpay payment link short URL sent to the user (deprecated — use fund account validation) */
  razorpayPaymentLinkUrl: string | null;

  /**
   * Razorpay fund account validation ID (fav_xxx).
   * Returned when POST /v1/fund_accounts/validations is called to verify
   * the payment detail. Correlates fund_account.validated / fund_account.validation_failed
   * webhook events to this record.
   */
  razorpayValidationId: string | null;

  createdAt: Date;

  updatedAt: Date;
}