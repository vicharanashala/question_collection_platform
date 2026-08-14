import { IsNumber, IsPositive, IsString, IsNotEmpty, ValidateIf } from 'class-validator';
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

  /**
   * ID of the previously verified payment detail to disburse to.
   * Mongo document IDs are ObjectId hex strings, not UUIDs.
   */
  @IsString()
  @IsNotEmpty({ message: 'Invalid payment detail ID' })
  paymentDetailId: string;
}