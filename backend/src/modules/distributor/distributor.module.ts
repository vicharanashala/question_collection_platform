import { Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { DistributorController } from './distributor.controller';
import { DistributorService } from './distributor.service';

@Module({
  imports: [DbModule],
  controllers: [DistributorController],
  providers: [DistributorService],
  exports: [DistributorService],
})
export class DistributorModule {}