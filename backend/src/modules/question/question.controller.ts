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
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { ActorType, AuditAction, OutcomeStatus, UserRole } from '../../shared/classes/enums';
import { QuestionService } from './question.service';
import { SubmitQuestionDto, SubmitQuestionResponseDto, PreviewQuestionDto } from './dto/submit-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { AttachQuestionAudioDto } from './dto/attach-question-audio.dto';
import { ListQuestionsDto } from './dto/list-questions.dto';
import { Request } from 'express';
import { CacheInvalidate } from '../../shared/database/cache/decorators/cache-invalidate.decorator';
import { Cacheable } from '../../shared/database/cache/decorators/cacheable.decorator';
import { UserService } from '../user/user.service';
import { AnveshanSubmissionsOpenGuard } from '../user/guards/anveshan-submissions-open.guard';
import { AnveshanMilestoneService } from './anveshan-milestone.service';
import { SubmitAnveshanAnswerDto } from './dto/anveshan-answer.dto';
import { AuditLog } from '@/shared/database/mongodb/schemas/audit-log.schema';
import { AuditService } from '../audit-logs/audit.service';
import { AuditLogDto } from '../audit-logs/dto/audit_log-dto';
import { ReqMeta, RequestMeta } from '@/shared/middleware/decorators/request-meta.decorator';
import { Types } from 'mongoose';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string; name: string; email: string };
}

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly userService: UserService,
    private readonly anveshanMilestoneService: AnveshanMilestoneService,
    private readonly auditService: AuditService,
    private readonly logger: Logger = new Logger(QuestionController.name),
  ) {}

  // POST /questions — Submit a new question
  @Post()
  @UseGuards(AnveshanSubmissionsOpenGuard)
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
    const canViewContact = req.user.role === 'admin' || req.user.role === 'super_admin';
    const isStaff = canViewContact || req.user.role === 'curator';
    if (dto.userIds?.length && req.user.role !== 'super_admin') {
      throw new ForbiddenException('Only Super Admins can filter by users');
    }
    return this.questionService.list(req.user.id, dto, isStaff, canViewContact);
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

  // POST /questions/:id/audio — Attach recordings to a rejected duplicate saved by preview
  @Post(':id/audio')
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('questions:u*')
  async attachAudio(
    @Param('id') id: string,
    @Body() dto: AttachQuestionAudioDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.attachAudio(req.user.id, id, dto);
  }

  // GET /questions/stats/me — Daily submission count for current user
@Get('stats/me')
@Cacheable('question_stats', 60)
async getMyStats(@Req() req: AuthenticatedRequest) {
  const objectId = new Types.ObjectId(req.user.id);
  const [user, dailyCount, limits, totalApproved] = await Promise.all([
    this.userService.getProfile(objectId),
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
  @ReqMeta() meta: RequestMeta,
) {
  const base: AuditLogDto = {
    actionType: AuditAction.QUESTION_APPROVED,
    actor: {
      id: req.user.id,
      actorType:
      req.user.role === UserRole.SUPER_ADMIN ? ActorType.SUPER_ADMIN : ActorType.CURATOR,
      name: req.user.name,
    },
    resource: {
      ipAddress: meta.ipAddress ?? req.ip,
      requestId: meta.requestId ?? '',
    },
  };

  let data;
  try {
    data = await this.questionService.approve(id, req.user.id, reason);
  } catch (err) {
    await this.safeAudit({
      ...base,
      context: { questionId: id, reason },
      changes: { before: { status: 'pending' }, after: { status: 'pending' } },
      outcome: {
        status: OutcomeStatus.FAILURE,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err; // keep the real HTTP error
  }

  await this.safeAudit({
    ...base,
    context: { questionId: data?._id.toString(), userId: data?.userId, reason },
    changes: { before: { status: 'pending' }, after: { status: 'approved' } },
    outcome: { status: OutcomeStatus.SUCCESS },
  });

  return data;
}

private async safeAudit(payload: AuditLogDto) {
  try {
    const auditLog: Partial<AuditLog> = {
      ...payload,
      changes: payload.changes ?? undefined,
      context: payload.context ?? undefined,
      outcome: payload.outcome ?? undefined,
    };

    await this.auditService.createAuditLog(auditLog);
  } catch (e) {
    this.logger.error('Failed to write audit log', e instanceof Error ? e.stack : String(e));
  }
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
    @ReqMeta() meta: RequestMeta,
  ) {
    const finalReason = reason ?? 'Not provided';
    const base: AuditLogDto = {
      actionType: AuditAction.QUESTION_REJECTED,
      actor: {
        id: req.user.id,
        actorType:
          req.user.role === UserRole.SUPER_ADMIN ? ActorType.SUPER_ADMIN : ActorType.ADMIN,
        name: req.user.name,
      },
      resource: {
        ipAddress: meta.ipAddress ?? req.ip,
        requestId: meta.requestId ?? '',
      },
      context: { questionId: id, reason: finalReason },
    };

    try {
      const data = await this.questionService.reject(id, req.user.id, finalReason);
      await this.safeAudit({ ...base, outcome: { status: OutcomeStatus.SUCCESS } });
      return data;
    } catch (err) {
      await this.safeAudit({
        ...base,
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  // GET /questions/anveshan-milestone/me — the caller's submission and answer progress.
  @Get('anveshan-milestone/me')
  @Cacheable('anveshan_milestone', 60)
  async getMyAnveshanMilestone(@Req() req: AuthenticatedRequest) {
    return this.anveshanMilestoneService.getMilestone(req.user.id);
  }

    // GET /questions/anveshan-answers/:questionId/score — the caller's system score for an answer; poll while status is processing.
  @Get('anveshan-answers/:questionId/score')
  async getAnveshanAnswerScore(@Param('questionId') questionId: string, @Req() req: AuthenticatedRequest) {
    return this.anveshanMilestoneService.getAnswerScore(req.user.id, questionId);
  } 
  
  // GET /questions/anveshan-answers/me — the caller's own questions they can answer, with answer status.
  @Get('anveshan-answers/me')
  async listMyAnveshanAnswerQuestions(@Req() req: AuthenticatedRequest) {
    return this.anveshanMilestoneService.listAnswerableQuestions(req.user.id);
  }

  // GET /questions/:id/anveshan-answer — staff view of the answer an Anveshan user wrote for this question.
  @Get(':id/anveshan-answer')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR)
  async getAnveshanAnswer(@Param('id') id: string) {
    return { answer: await this.anveshanMilestoneService.getAnswerForQuestion(id) };
  }

  // POST /questions/anveshan-answers/:questionId — answer one of the caller's own questions with sources.
  @Post('anveshan-answers/:questionId')
  @UseGuards(AnveshanSubmissionsOpenGuard)
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate('anveshan_milestone*', 'questions:*')
  async submitAnveshanAnswer(
    @Param('questionId') questionId: string,
    @Body() dto: SubmitAnveshanAnswerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.anveshanMilestoneService.submitAnswer(req.user.id, questionId, dto);
  }
}
