import { Module, forwardRef } from '@nestjs/common';
import { GdbService } from './gdb.service';
import { AdminModule } from '../admin/admin.module';
import { DbModule } from '../../shared/database/db.module';
import { SarvamService } from '../speech/sarvam.service';

@Module({
  imports: [
    DbModule,
    forwardRef(() => AdminModule), // for AdminService.getConfigValue()
  ],
  providers: [GdbService, SarvamService],
  exports: [GdbService],
})
export class GdbModule {}