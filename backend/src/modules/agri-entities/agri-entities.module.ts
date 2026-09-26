import { Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { AgriEntitiesController } from './agri-entities.controller';
import { AgriEntitiesService } from './agri-entities.service';

@Module({
  imports: [DbModule],
  controllers: [AgriEntitiesController],
  providers: [AgriEntitiesService],
  exports: [AgriEntitiesService]
})
export class AgriEntitiesModule {}
