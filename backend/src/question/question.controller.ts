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
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { QuestionService } from './question.service';
import { SubmitQuestionDto, SubmitQuestionResponseDto, PreviewQuestionDto } from './dto/submit-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ListQuestionsDto } from './dto/list-questions.dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  // POST /questions — Submit a new question
  @Post()
  @HttpCode(HttpStatus.CREATED)
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
  async list(
    @Query() dto: ListQuestionsDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ items: unknown[]; total: number; page: number; limit: number; pages: number }> {
    return this.questionService.list(req.user.id, dto, req.user.role === 'admin' || req.user.role === 'super_admin');
  }

  // GET /questions/:id — Get single question
  @Get(':id')
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.findOne(id, req.user.id);
  }

  // PATCH /questions/:id — Update question (edit window only)
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuestionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.update(req.user.id, id, dto);
  }

  // GET /questions/stats/me — Daily submission count for current user
  @Get('stats/me')
  async getMyStats(@Req() req: AuthenticatedRequest) {
    const [dailyCount, limits] = await Promise.all([
      this.questionService.getDailyCount(req.user.id),
      this.questionService.getLimits(),
    ]);

    return {
      dailyCount,
      remainingToday: Math.max(0, limits.dailyLimit - dailyCount),
      ...limits,
    };
  }

  // Admin routes (protected by roles guard)
  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('reason') reason: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.approve(id, req.user.id, reason);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.questionService.reject(id, req.user.id, reason ?? 'Not provided');
  }
}