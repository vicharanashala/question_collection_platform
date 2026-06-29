import { IsOptional, IsString, IsDateString, IsInt, Min, Max, IsArray, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserRole } from '../../common/enums';

export class QueryAuditLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  /** Filter by a specific actor's ID */
  @IsOptional()
  @IsString()
  actorId?: string;

  /** Filter by actor type: admin | curator | user | system */
  @IsOptional()
  @IsString()
  actorType?: string;

  /** Filter by role of actors to include: admin | curator | finance */
  @IsOptional()
  @IsIn(['admin', 'curator', 'finance'])
  @Transform(({ value }) => value?.toLowerCase())
  role?: UserRole;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return value.split(',').map((s: string) => s.trim());
    return value;
  })
  actions?: string[];

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'action' | 'actorId';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}