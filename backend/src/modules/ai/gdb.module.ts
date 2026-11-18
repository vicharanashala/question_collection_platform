import { Module, forwardRef } from '@nestjs/common';
import { GdbService } from './services/gdb.service';
import { AdminModule } from '../admin/admin.module';
import { DbModule } from '../../shared/database/db.module';
import { SarvamService } from '../speech/services/sarvam.service';

@Module({
  imports: [
    DbModule,
    forwardRef(() => AdminModule), // for AdminConfigService.getConfigValue()
  ],
  providers: [GdbService, SarvamService],
  exports: [GdbService],
})
export class GdbModule {}