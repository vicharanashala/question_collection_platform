import { Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { AgriEntitiesController } from './agri-entities.controller';
import { AgriEntitiesService } from './agri-entities.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [DbModule, UserModule],
  controllers: [AgriEntitiesController],
  providers: [AgriEntitiesService],
})
export class AgriEntitiesModule {}
