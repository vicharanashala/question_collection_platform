import { Module, forwardRef } from '@nestjs/common';
import { GdbService } from './gdb.service';
import { AdminModule } from '../admin/admin.module';
import { DbModule } from '../../shared/database/db.module';

@Module({
  imports: [
    DbModule,
    forwardRef(() => AdminModule), // for AdminService.getConfigValue()
  ],
  providers: [GdbService],
  exports: [GdbService],
})
export class GdbModule {}