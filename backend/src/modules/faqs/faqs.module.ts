import { Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { FaqsController } from './faqs.controller';
import { FaqsService } from './faqs.service';

@Module({
  imports: [DbModule],
  controllers: [FaqsController],
  providers: [FaqsService],
  exports: [FaqsService],
})
export class FaqsModule {}