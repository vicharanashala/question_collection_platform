import { IsString, IsOptional, IsIn, IsDateString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SuspendUserDto {
  @IsString()
  @IsIn(['suspend', 'ban'])
  action: 'suspend' | 'ban';

  @IsOptional()
  @IsString()
  reason?: string;

  /** ISO-8601 date-time — required for suspend, ignored for ban */
  @IsOptional()
  @IsDateString()
  suspendedUntil?: string;
}

export class UserActionsDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @MinLength(3, { message: 'Rejection reason must be at least 3 characters' })
  @MaxLength(500)
  reason: string;
}