import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { UserRole } from '../../shared/classes/enums';
import { INDIAN_STATES } from '../../shared/constants/indian-states.constant';

import { DistributorService } from './distributor.service';
import {
  AssignStatesDto,
  ListApprovedQuestionsDto,
  ListDistributionsDto,
} from './dto';

interface AuthedRequest extends Express.Request {
  user: { id: string; role: UserRole };
}

@Controller('distributor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class DistributorController {
  constructor(private readonly distributorService: DistributorService) {}

  // ── Reference data ───────────────────────────────────────────────────────

  @Get('indian-states')
  @HttpCode(HttpStatus.OK)
  listIndianStates() {
    return { states: INDIAN_STATES };
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  getStats() {
    return this.distributorService.getStats();
  }

  // ── Approved-questions queue ─────────────────────────────────────────────

  @Get('questions')
  @HttpCode(HttpStatus.OK)
  listApprovedQuestions(
    @Req() req: AuthedRequest,
    @Query() dto: ListApprovedQuestionsDto,
  ) {
    return this.distributorService.listApprovedQuestions(
      req.user.id,
      req.user.role,
      dto,
    );
  }

  @Get('questions/:id')
  @HttpCode(HttpStatus.OK)
  getApprovedQuestion(@Param('id') id: string) {
    return this.distributorService.getApprovedQuestion(id);
  }

  // ── Assign / list distribution ───────────────────────────────────────────

  @Post('questions/:id/assign-states')
  @HttpCode(HttpStatus.CREATED)
  // Method-level @Roles overrides the class-level @Roles via the RolesGuard's
  // getAllAndOverride. Only the `distributor` role may move an approved
  // question into `final_questions`; curator/admin/super_admin can still
  // browse and monitor distributions but must not perform the
  // promote-to-final action.
  @Roles(UserRole.DISTRIBUTOR)
  assignStates(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: AssignStatesDto,
  ) {
    return this.distributorService.assignStates(req.user.id, req.user.role, id, dto);
  }

  @Get('distributions')
  @HttpCode(HttpStatus.OK)
  listDistributions(
    @Req() req: AuthedRequest,
    @Query() dto: ListDistributionsDto,
  ) {
    return this.distributorService.listDistributions(req.user.id, req.user.role, dto);
  }

  @Get('distributions/by-question/:questionId')
  @HttpCode(HttpStatus.OK)
  getDistributionsForQuestion(@Param('questionId') questionId: string) {
    return this.distributorService.getDistributionsForQuestion(questionId);
  }
}