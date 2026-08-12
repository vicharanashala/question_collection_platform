import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';

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