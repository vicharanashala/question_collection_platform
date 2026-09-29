import { Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { QuestionModule } from '../question/question.module';
import { FeedbacksController } from './feedbacks.controller';
import { FeedbacksService } from './feedbacks.service';

@Module({
  imports: [DbModule, QuestionModule],
  controllers: [FeedbacksController],
  providers: [FeedbacksService],
})
export class FeedbacksModule {}
