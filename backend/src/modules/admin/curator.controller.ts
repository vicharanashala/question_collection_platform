import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { CuratorService } from './curator.service';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { UserRole } from '../../shared/classes/enums';
import { AnalyticsQueryDto } from './dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string; name: string; email: string };
}

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
  async getCuratorStats(@Query() dto: AnalyticsQueryDto) {
    return this.curatorService.getCuratorStats(dto);
  }

  /**
   * The curator's personal review performance — approved / rejected / held / pending
   * counts attributed to the current curator, for the current week.
   */
  @Get('my-stats')
  @HttpCode(HttpStatus.OK)
  async getMyReviewStats(@Req() req: AuthenticatedRequest) {
    return this.curatorService.getCuratorReviewerStats(req.user.id);
  }
}