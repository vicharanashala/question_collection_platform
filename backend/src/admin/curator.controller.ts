import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CuratorService } from './curator.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('curator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CURATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class CuratorController {
  constructor(private readonly curatorService: CuratorService) {}

  /**
   * Overview stats for the curator dashboard:
   *   - Queue breakdown by status
   *   - Submission volume (today / this week / this month)
   *   - Approval rate
   *   - Average review turnaround
   *   - Top crops and states
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getCuratorStats() {
    return this.curatorService.getCuratorStats();
  }

  /**
   * The curator's personal review performance — approved / rejected / held / pending
   * counts attributed to the current curator, for the current week.
   */
  @Get('my-stats')
  @HttpCode(HttpStatus.OK)
  async getMyReviewStats(@Query('userId') userId: string) {
    return this.curatorService.getCuratorReviewerStats(userId);
  }
}