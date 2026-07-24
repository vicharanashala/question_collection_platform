import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { AnalyticsQueryDto, ExportQueryDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

/**
 * Analytics controller — shared dashboard data endpoints.
 * Class-level: ADMIN and SUPER_ADMIN only (user/question analytics are
 * platform operations; finance and curator have their own dashboards).
 *
 * getRewardAnalytics has a method-level override to also allow FINANCE.
 */
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AnalyticsController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * All dashboard stats + chart data in one call.
   * GET /analytics/dashboard
   */
  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async getDashboard(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getAnalyticsDashboard(dto);
  }

  /**
   * User engagement metrics — DAU, MAU, retention.
   * GET /analytics/users
   */
  @Get('users')
  @HttpCode(HttpStatus.OK)
  async getUserAnalytics(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getUserAnalytics(dto);
  }

  /**
   * Question volume + breakdown by state, crop, domain.
   * GET /analytics/questions
   */
  @Get('questions')
  @HttpCode(HttpStatus.OK)
  async getQuestionAnalytics(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getQuestionAnalytics(dto);
  }

  /**
   * Reward and payout totals.
   * GET /analytics/rewards
   *
   * Method-level override: also allows FINANCE role.
   */
  @Get('rewards')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  async getRewardAnalytics(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getRewardAnalytics(dto);
  }
}

/**
 * Export controller — consistent RBAC for all export formats.
 * GET /export/csv
 * GET /export/excel
 */
@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ExportController {
  constructor(private readonly adminService: AdminService) {}

  @Get('csv')
  @HttpCode(HttpStatus.OK)
  async exportCSV(@Query() dto: ExportQueryDto, @Res() res: Response) {
    dto.format = 'csv';
    const result = await this.adminService.exportData(dto);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${dto.dataType ?? 'export'}_${Date.now()}.csv"`,
    );
    return res.send((result as { data: string }).data);
  }

  @Get('excel')
  @HttpCode(HttpStatus.OK)
  async exportExcel(@Query() dto: ExportQueryDto, @Res() res: Response) {
    dto.format = 'excel';
    const result = await this.adminService.exportData(dto);
    const xlsString = (result as { xls: string }).xls;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${dto.dataType ?? 'export'}_${Date.now()}.xlsx"`,
    );
    return res.send(xlsString);
  }
}