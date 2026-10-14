import { ActorType, AuditAction, OutcomeStatus, UserRole } from "@/shared/classes/enums/index";
import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsObject, IsOptional, IsString } from "class-validator";

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
  @IsIn(['admin', 'curator', 'distributor', 'finance'])
  @Transform(({ value }) => value?.toLowerCase())
  role?: UserRole;
}

export class AuditLogDto {
    @IsString()
    actionType: AuditAction;

    @IsObject()
    actor: {
      id: string;
      name: string;
      actorType: ActorType;
    };

    @IsOptional()
    @IsObject()
    context?: Record<string, any> | null;

    @IsOptional()
    @IsObject()
    changes?: {
      before: Record<string, any> | null;
      after: Record<string, any> | null;
    } | null;

    @IsOptional()
    @IsObject()
    outcome?: {
      status: OutcomeStatus;
      errorMessage?: string;
      errorStack?: string;
      errorCode?: string;
    } | null;

    @IsObject()
    resource: {
        ipAddress?: string;
        requestId?: string;
    }
};

