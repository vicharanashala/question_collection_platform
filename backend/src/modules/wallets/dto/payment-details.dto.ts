import {
  IsIn,
  IsString,
  Length,
  Matches,
  ValidateIf,
  IsOptional,
} from 'class-validator';

export class AddPaymentDetailDto {
  @IsIn(['upi', 'bank_transfer'])
  payoutMethod: 'upi' | 'bank_transfer';

  // ── UPI fields ────────────────────────────────────────────────────────────

  @ValidateIf((o) => o.payoutMethod === 'upi')
  @IsString()
  @Matches(/^[a-zA-Z0-9.\-_]{2,50}@[a-zA-Z0-9]{2,15}$/, {
    message: 'UPI ID must be in a valid format (e.g. yourname@upi)',
  })
  upiId?: string;

  // ── Bank account fields ───────────────────────────────────────────────────

  @ValidateIf((o) => o.payoutMethod === 'bank_transfer')
  @IsString()
  @Length(9, 18, { message: 'Account number must be 9–18 digits' })
  @Matches(/^\d{9,18}$/, { message: 'Account number must contain only digits' })
  accountNumber?: string;

  /** Must match accountNumber exactly */
  @ValidateIf((o) => o.payoutMethod === 'bank_transfer')
  @IsString()
  @Length(9, 18)
  @Matches(/^\d{9,18}$/, { message: 'Please enter the same account number' })
  confirmAccountNumber?: string;

  @ValidateIf((o) => o.payoutMethod === 'bank_transfer')
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'IFSC must be 11 characters: 4 letters, 0, 6 alphanumeric (e.g. SBIN0001234)',
  })
  ifsc?: string;

  @ValidateIf((o) => o.payoutMethod === 'bank_transfer')
  @IsString()
  @Length(2, 100, { message: 'Account holder name must be 2–100 characters' })
  accountHolderName?: string;

  @ValidateIf((o) => o.payoutMethod === 'bank_transfer')
  @IsString()
  @Length(2, 200)
  bankName?: string;
}

export class AddPaymentDetailResponseDto {
  id: string;
  status: 'pending' | 'in_progress' | 'verified' | 'failed';
  payoutMethod: 'upi' | 'bank_transfer';
  displayValue: string; // e.g. "user@upi" or "****1234"
  message: string;
  /** Short URL for the ₹1 Razorpay Payment Link. Present only while status is in_progress. */
  paymentLinkUrl?: string;
}

export class PaymentDetailDto {
  id: string;
  payoutMethod: 'upi' | 'bank_transfer';
  status: 'pending' | 'in_progress' | 'verified' | 'failed';
  displayValue: string; // masked: "****1234" for bank, full UPI ID
  bankName: string | null;
  ifsc: string | null;
  accountHolderName: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  /** Short URL for the ₹1 Razorpay Payment Link. Present only while status is in_progress. */
  paymentLinkUrl?: string;
}