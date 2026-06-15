import { IsString, IsOptional, IsIn } from 'class-validator';

export class SuspendUserDto {
  @IsString()
  @IsIn(['suspended', 'banned'])
  action: 'suspend' | 'ban';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UserActionsDto {
  @IsOptional()
  @IsString()
  reason?: string;
}