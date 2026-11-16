import { Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { QuestionModule } from '../question/question.module';
import { FeedbacksController } from './controllers/feedbacks.controller';
import { FeedbacksService } from './services/feedbacks.service';

@Module({
  imports: [DbModule, QuestionModule],
  controllers: [FeedbacksController],
  providers: [FeedbacksService],
})
export class FeedbacksModule {}
