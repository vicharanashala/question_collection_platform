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
  CreateUserDto,
  SuspendUserDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

interface AuthenticatedRequest extends Request {
  user: { id: string; mobileNumber: string; role: string };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─────────────────────────────────────────────────────────────
  // Section 1: User Management — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Post('users')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.adminService.createUser(req.user.id, req.user.role as UserRole, dto);
  }

  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async listUsers(@Query() dto: ListUsersDto) {
    return this.adminService.listUsers(dto);
  }

  @Get('users/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Post('users/:id/suspend')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @Param('id') id: string,
    @Body() body: SuspendUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.suspendOrBanUser(
      req.user.id,
      id,
      body.action,
      body.reason,
      body.suspendedUntil,
    );
  }

  @Post('users/:id/unsuspend')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async unsuspendUser(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.adminService.unsuspendOrUnbanUser(req.user.id, id);
  }

  @Post('users/:id/verify')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async verifyUser(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.adminService.verifyUser(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 2: Question Review — curator allowed
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
    const role = req.user.role as UserRole;
    return this.adminService.reviewQuestion(req.user.id, id, dto, role);
  }

  /** Question quality and volume metrics — curator read-only */
  @Get('questions/metrics')
  @HttpCode(HttpStatus.OK)
  async getQuestionMetrics(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getQuestionMetrics(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 3: Configuration — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get('config')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async listConfig() {
    return this.adminService.listConfig();
  }

  @Post('config')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createConfig(
    @Body() dto: CreateConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.createConfig(req.user.id, dto);
  }

  @Patch('config')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @Body() dto: UpdateConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.updateConfig(req.user.id, dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 4: Analytics Dashboard — curator allowed (metrics only)
  // ─────────────────────────────────────────────────────────────

  @Get('analytics/dashboard')
  @HttpCode(HttpStatus.OK)
  async getDashboard(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getDashboardStats(dto);
  }

  /** Full stats for the admin dashboard — curator allowed */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getStats(dto);
  }

  @Get('analytics/rewards')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getRewardSummary(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getRewardSummary(dto);
  }

  @Get('analytics/reward-logs')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getRewardLogs(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.listRewardLogs(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 5: Fraud — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get('fraud')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getFraudStats(@Query() dto: { page?: number; limit?: number; state?: string }) {
    return this.adminService.getFraudStats(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 6: Withdrawals — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get('withdrawals')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async listWithdrawals(@Query() dto: ListWithdrawalsDto) {
    return this.adminService.listWithdrawals(dto);
  }

  @Post('withdrawals/:id/process')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async processWithdrawal(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.processWithdrawal(req.user.id, id, dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 7: Export — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async exportData(@Query() dto: ExportQueryDto, @Res() res: Response) {
    const result = await this.adminService.exportData(dto);

    if (result.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${dto.dataType}_${Date.now()}.csv"`);
      return res.send(result.data);
    }

    return res.json(result);
  }
}