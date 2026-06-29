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
import { QueryAuditLogsDto, AuditStatsDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserRole } from '../common/enums';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async queryAuditLogs(
    @Query() dto: QueryAuditLogsDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string; role: string };
    return this.auditService.queryAuditLogs(
      dto,
      user.id,
      user.role as UserRole,
    );
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getActorStats(
    @Query() dto: AuditStatsDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string; role: string };
    return this.auditService.getActorStats(
      dto,
      user.id,
      user.role as UserRole,
    );
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getSummary(
    @Query() dto: AuditStatsDto & { granularity?: string },
    @Req() req: Request,
  ) {
    const user = req.user as { id: string; role: string };
    return this.auditService.getSummary(
      dto,
      user.id,
      user.role as UserRole,
    );
  }

  @Get('entity/:entityType/:entityId')
  @HttpCode(HttpStatus.OK)
  async getEntityHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string; role: string };
    return this.auditService.getEntityHistory(
      entityType,
      entityId,
      user.id,
      user.role as UserRole,
    );
  }

  /** List users (name + email) belonging to a given role — for the filter dropdown */
  @Get('users-by-role')
  @HttpCode(HttpStatus.OK)
  async getUsersByRole(
    @Query('role') role: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string; role: string };
    return this.auditService.getUsersByRole(
      role as UserRole,
      user.id,
      user.role as UserRole,
    );
  }
}