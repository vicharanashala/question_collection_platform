import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { CacheInvalidate } from '../../shared/database/cache/decorators/cache-invalidate.decorator';
import { FeedbacksService } from './feedbacks.service';
import { SubmitAnveshanFeedbackDto } from './dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('feedbacks')
@UseGuards(JwtAuthGuard)
export class FeedbacksController {
  constructor(private readonly feedbacksService: FeedbacksService) {}

  // POST /feedbacks/anveshan — rating and comment after the Anveshan milestone reaches 100%.
  @Post('anveshan')
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate('anveshan_milestone*')
  async submitAnveshanFeedback(@Body() dto: SubmitAnveshanFeedbackDto, @Req() req: AuthenticatedRequest) {
    return this.feedbacksService.submitAnveshanFeedback(req.user.id, dto);
  }
}
