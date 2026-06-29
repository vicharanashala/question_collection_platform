import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../common/enums';

export class AuditStatsDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  actorType?: string;

  @IsOptional()
  @IsString()
  state?: string;

  /** Filter by role: admin | curator | finance */
  @IsOptional()
  @IsIn(['admin', 'curator', 'finance'])
  @Transform(({ value }) => value?.toLowerCase())
  role?: UserRole;
}