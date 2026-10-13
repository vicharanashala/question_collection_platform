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
import { UserRole } from '../../shared/classes/enums';
import { Roles, RolesGuard } from '@/shared';

@Controller('/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(private readonly auditService: AuditService) {}

@Get("/")
@UseGuards(RolesGuard) // plus whatever auth guard your other admin controllers use
@Roles(UserRole.SUPER_ADMIN)
  list(@Query() query: QueryAuditLogsDto) {
    return this.auditService.listAuditLogs(query);
  }
}