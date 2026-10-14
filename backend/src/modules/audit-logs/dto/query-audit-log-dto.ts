import { IsOptional, IsString, IsDateString, IsInt, Min, Max, IsArray, IsIn, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ActorType, AuditAction, UserRole } from '../../../shared/classes/enums';


export class QueryAuditLogsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number = 50;

  /** Filter by a specific actor's ID (actor.id) */
  @IsOptional() @IsString()
  actorId?: string;

  /** Role of the actor who performed the action (actor.actorType) */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(ActorType)
  role?: ActorType;

  /** Single action type */
  @IsOptional() @IsString()
  actionType?: AuditAction;

  /** Multiple action types, comma-separated or repeated */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((s: string) => s.trim()) : value,
  )
  @IsArray() @IsString({ each: true })
 actionTypes?: AuditAction[];

  @IsOptional() @IsDateString()
  fromDate?: string;

  @IsOptional() @IsDateString()
  toDate?: string;

  /** Matches actor name or email */
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsIn(['createdAt', 'actionType', 'actorId'])
  sortBy?: 'createdAt' | 'actionType' | 'actorId' = 'createdAt';

  @IsOptional() @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}