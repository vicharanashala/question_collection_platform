import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto, ReplyReportDto, ListReportsDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, ReportStatus, ReportPriority } from '../common/enums';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─── User routes ──────────────────────────────────────────────────────────

  /** Submit a new report (any authenticated user) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createReport(
    @Body() dto: CreateReportDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const report = await this.reportsService.createReport(req.user.id, dto);
    return { id: report.id, message: 'Report submitted successfully' };
  }

  /** Get a single report belonging to the current user */
  @Get('my/:id')
  @HttpCode(HttpStatus.OK)
  async getMyReport(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const report = await this.reportsService.getMyReport(req.user.id, id);
    if (!report) {
      throw new Error('Report not found');
    }
    return report;
  }

  /** Get current user's own reports */
  @Get('my')
  @HttpCode(HttpStatus.OK)
  async getMyReports(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getMyReports(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ─── Admin routes ─────────────────────────────────────────────────────────

  /** List all reports with optional filters */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  async listReports(@Query() dto: ListReportsDto) {
    return this.reportsService.listReports(dto);
  }

  /** Get a single report with its reply thread */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  async getReport(@Param('id') id: string) {
    const report = await this.reportsService.getReport(id);
    if (!report) {
      return { message: 'Report not found' };
    }
    return report;
  }

  /** Update report status */
  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ReportStatus },
    @Req() req: AuthenticatedRequest,
  ) {
    const report = await this.reportsService.updateStatus(
      id,
      body.status,
      req.user.id,
      req.user.role as UserRole,
    );
    return { id: report.id, status: report.status, message: 'Status updated' };
  }

  /** Update report priority */
  @Patch(':id/priority')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  async updatePriority(
    @Param('id') id: string,
    @Body() body: { priority: ReportPriority },
    @Req() req: AuthenticatedRequest,
  ) {
    const report = await this.reportsService.updatePriority(
      id,
      body.priority,
      req.user.id,
      req.user.role as UserRole,
    );
    return { id: report.id, priority: report.priority, message: 'Priority updated' };
  }

  /** Add a reply to a report */
  @Post(':id/replies')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @HttpCode(HttpStatus.CREATED)
  async addReply(
    @Param('id') id: string,
    @Body() dto: ReplyReportDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const reply = await this.reportsService.addReply(
      id,
      req.user.id,
      req.user.role as UserRole,
      dto,
    );
    return { id: reply.id, message: 'Reply sent' };
  }
}