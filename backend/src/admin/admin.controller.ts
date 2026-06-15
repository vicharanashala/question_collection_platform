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
  Res,
  Header,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AdminService } from './admin.service';
import {
  ListUsersDto,
  ListReviewQueueDto,
  ReviewActionDto,
  UpdateConfigDto,
  CreateConfigDto,
  AnalyticsQueryDto,
  ExportQueryDto,
  ListWithdrawalsDto,
  ProcessWithdrawalDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { RolesGuard as RolesGuardImport } from '../common/guards/roles.guard';

interface AuthenticatedRequest extends Request {
  user: { id: string; mobileNumber: string; role: string };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuardImport)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─────────────────────────────────────────────────────────────
  // Section 1: User Management
  // ─────────────────────────────────────────────────────────────

  @Get('users')
  @HttpCode(HttpStatus.OK)
  async listUsers(@Query() dto: ListUsersDto) {
    return this.adminService.listUsers(dto);
  }

  @Get('users/:id')
  @HttpCode(HttpStatus.OK)
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @Param('id') id: string,
    @Body() body: { action: 'suspend' | 'ban'; reason?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.suspendOrBanUser(req.user.id, id, body.action, body.reason);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 2: Question Review
  // ─────────────────────────────────────────────────────────────

  @Get('questions/queue')
  @HttpCode(HttpStatus.OK)
  async listReviewQueue(@Query() dto: ListReviewQueueDto) {
    return this.adminService.listReviewQueue(dto);
  }

  @Get('questions/:id')
  @HttpCode(HttpStatus.OK)
  async getQuestion(@Param('id') id: string) {
    return this.adminService.getQuestionForReview(id);
  }

  @Post('questions/:id/review')
  @HttpCode(HttpStatus.OK)
  async reviewQuestion(
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.reviewQuestion(req.user.id, id, dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 3: Configuration
  // ─────────────────────────────────────────────────────────────

  @Get('config')
  @HttpCode(HttpStatus.OK)
  async listConfig() {
    return this.adminService.listConfig();
  }

  @Post('config')
  @HttpCode(HttpStatus.CREATED)
  async createConfig(
    @Body() dto: CreateConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.createConfig(req.user.id, dto);
  }

  @Patch('config')
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @Body() dto: UpdateConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.updateConfig(req.user.id, dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 4: Analytics Dashboard
  // ─────────────────────────────────────────────────────────────

  @Get('analytics/dashboard')
  @HttpCode(HttpStatus.OK)
  async getDashboard(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getDashboardStats(dto);
  }

  @Get('analytics/rewards')
  @HttpCode(HttpStatus.OK)
  async getRewardSummary(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getRewardSummary(dto);
  }

  @Get('analytics/reward-logs')
  @HttpCode(HttpStatus.OK)
  async getRewardLogs(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.listRewardLogs(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 5: Fraud
  // ─────────────────────────────────────────────────────────────

  @Get('fraud')
  @HttpCode(HttpStatus.OK)
  async getFraudStats(@Query() dto: { page?: number; limit?: number; state?: string }) {
    return this.adminService.getFraudStats(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 6: Withdrawals
  // ─────────────────────────────────────────────────────────────

  @Get('withdrawals')
  @HttpCode(HttpStatus.OK)
  async listWithdrawals(@Query() dto: ListWithdrawalsDto) {
    return this.adminService.listWithdrawals(dto);
  }

  @Post('withdrawals/:id/process')
  @HttpCode(HttpStatus.OK)
  async processWithdrawal(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.processWithdrawal(req.user.id, id, dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 7: Export
  // ─────────────────────────────────────────────────────────────

  @Get('export')
  @HttpCode(HttpStatus.OK)
  async exportData(@Query() dto: ExportQueryDto, @Res() res: Response) {
    const result = await this.adminService.exportData(dto);

    if (result.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${dto.dataType}_${Date.now()}.csv"`);
      return res.send(result.data);
    }

    // For Excel, return JSON and the client can handle conversion
    // A full Excel implementation would use a package like exceljs
    return res.json(result);
  }
}