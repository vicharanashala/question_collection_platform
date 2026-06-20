import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto, AuditStatsDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async queryAuditLogs(@Query() dto: QueryAuditLogsDto) {
    return this.auditService.queryAuditLogs(dto);
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getActorStats(@Query() dto: AuditStatsDto) {
    return this.auditService.getActorStats(dto);
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getSummary(@Query() dto: AuditStatsDto & { granularity?: string }) {
    return this.auditService.getSummary(dto);
  }

  @Get('entity/:entityType/:entityId')
  @HttpCode(HttpStatus.OK)
  async getEntityHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getEntityHistory(entityType, entityId);
  }
}