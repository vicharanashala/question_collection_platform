import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { UserRole } from '../../shared/classes/enums';
import { QuestionService } from './question.service';
import { SubmitQuestionDto, SubmitQuestionResponseDto, PreviewQuestionDto } from './dto/submit-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ListQuestionsDto } from './dto/list-questions.dto';
import { Request } from 'express';
import { CacheInvalidate } from '../../shared/database/cache/decorators/cache-invalidate.decorator';
import { Cacheable } from '../../shared/database/cache/decorators/cacheable.decorator';
import { UserService } from '../user/user.service';
import { AnveshanMilestoneService } from './anveshan-milestone.service';
import { SubmitAnveshanAnswerDto } from './dto/anveshan-answer.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly userService: UserService,
    private readonly anveshanMilestoneService: AnveshanMilestoneService,
  ) {}

  // POST /questions — Submit a new question
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate('questions:u*', 'anveshan_milestone*')
  async submit(
    @Body() dto: SubmitQuestionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SubmitQuestionResponseDto> {
    return this.questionService.submit(req.user.id, dto);
  }

  // POST /questions/preview — Validate and enrich fields; no DB write
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Body() dto: PreviewQuestionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.preview(req.user.id, dto);
  }

  // GET /questions — List questions (own or all for admin)
  @Get()
  @Cacheable('questions', 120)
  async list(
    @Query() dto: ListQuestionsDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ items: unknown[]; total: number; page: number; limit: number; pages: number }> {
    return this.questionService.list(req.user.id, dto, req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'curator');
  }

  // GET /questions/:id — Get single question
  @Get(':id')
  @Cacheable('question', 300)
  async getOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.findOne(id, req.user.id);
  }

  // PATCH /questions/:id — Update question (edit window only)
  @Patch(':id')
  @CacheInvalidate('hot:today:*', 'hot:total_approved')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.update(req.user.id, id, dto);
  }

  // GET /questions/stats/me — Daily submission count for current user
@Get('stats/me')
@Cacheable('question_stats', 60)
async getMyStats(@Req() req: AuthenticatedRequest) {
  const [user, dailyCount, limits, totalApproved] = await Promise.all([
    this.userService.getProfile(req.user.id),
    this.questionService.getDailyCount(req.user.id),
    this.questionService.getLimits(),
    this.questionService.getApprovedCount(req.user.id),
  ]);

  const unlimited = !!user?.isAnveshanUser;

  return {
    ...limits,
    dailyCount,
    remainingToday: unlimited ? null : Math.max(0, limits.dailyLimit - dailyCount),
    dailyLimit: unlimited ? null : limits.dailyLimit,
    unlimited,
    totalApproved,
  };
}

  // Admin routes (protected by roles guard)
  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('leaderboard:top_users', 'hot:*', 'analytics:*', 'query:review_queue*')
  async approve(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.approve(id, req.user.id, reason);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('hot:*', 'analytics:*')
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.reject(id, req.user.id, reason ?? 'Not provided');
  }

  // GET /questions/anveshan-milestone/me — the caller's submission and answer progress.
  @Get('anveshan-milestone/me')
  @Cacheable('anveshan_milestone', 60)
  async getMyAnveshanMilestone(@Req() req: AuthenticatedRequest) {
    return this.anveshanMilestoneService.getMilestone(req.user.id);
  }

  // GET /questions/anveshan-answers/me — the caller's own questions they can answer, with answer status.
  @Get('anveshan-answers/me')
  async listMyAnveshanAnswerQuestions(@Req() req: AuthenticatedRequest) {
    return this.anveshanMilestoneService.listAnswerableQuestions(req.user.id);
  }

  // POST /questions/anveshan-answers/:questionId — answer one of the caller's own questions with sources.
  @Post('anveshan-answers/:questionId')
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate('anveshan_milestone*')
  async submitAnveshanAnswer(
    @Param('questionId') questionId: string,
    @Body() dto: SubmitAnveshanAnswerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.anveshanMilestoneService.submitAnswer(req.user.id, questionId, dto);
  }
}