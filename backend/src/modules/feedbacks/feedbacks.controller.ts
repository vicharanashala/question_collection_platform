import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { UserRole } from '../../shared/classes/enums';
import { Request } from 'express';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { CacheInvalidate } from '../../shared/database/cache/decorators/cache-invalidate.decorator';
import { FeedbacksService } from './feedbacks.service';
import { ListFeedbacksDto, SubmitAnveshanFeedbackDto } from './dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('feedbacks')
@UseGuards(JwtAuthGuard)
export class FeedbacksController {
  constructor(private readonly feedbacksService: FeedbacksService) {}

  // GET /feedbacks/anveshan — admin view of all Anveshan feedback with a ratings summary.
  @Get('anveshan')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async listAnveshanFeedback(@Query() dto: ListFeedbacksDto) {
    return this.feedbacksService.listAnveshanFeedback(dto);
  }

  // POST /feedbacks/anveshan — rating and comment after the Anveshan milestone reaches 100%.
  @Post('anveshan')
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate('anveshan_milestone*')
  async submitAnveshanFeedback(@Body() dto: SubmitAnveshanFeedbackDto, @Req() req: AuthenticatedRequest) {
    return this.feedbacksService.submitAnveshanFeedback(req.user.id, dto);
  }
}
