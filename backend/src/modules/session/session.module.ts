import { Logger, Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { DbModule } from '../../shared/database/db.module';

@Module({
  imports: [DbModule],
  providers: [SessionService, Logger],
  exports: [SessionService],
})
export class SessionModule {}