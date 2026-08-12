import { IsNumber, IsPositive, IsUUID, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Unified withdraw DTO.
 * The user must provide a verified paymentDetailId that they previously added
 * and got verified via micro-transaction.
 */
export class WithdrawDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  /** ID of the previously verified payment detail to disburse to. */
  @IsUUID('4', { message: 'Invalid payment detail ID' })
  paymentDetailId: string;
}