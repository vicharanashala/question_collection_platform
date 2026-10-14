import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { AuditStatsDto } from './dto/audit_log-dto';
import { QueryAuditLogsDto } from './dto/query-audit-log-dto';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { ActorType, UserRole } from '../../shared/classes/enums';
import { Roles, RolesGuard } from '@/shared';
import { ok } from 'assert';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
    name: string;
  };
}
@Controller('/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.CURATOR,
  UserRole.FINANCE,
  UserRole.DISTRIBUTOR,
)
export class AuditLogsController {
  constructor(private readonly auditService: AuditService) {}

@Get("/")
@HttpCode(HttpStatus.OK)
  list(@Query() query: QueryAuditLogsDto, @Req() req: AuthenticatedRequest) {
    return this.auditService.listAuditLogs(query, req.user);
  }
}