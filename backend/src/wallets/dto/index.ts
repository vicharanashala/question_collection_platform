import { IsNumber, IsPositive, IsIn, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class WithdrawDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsIn(['upi', 'bank_transfer'])
  payoutMethod: 'upi' | 'bank_transfer';

  @IsObject()
  payoutDetails: Record<string, unknown>;
}