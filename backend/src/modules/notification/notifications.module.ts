import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { DbModule } from '../../shared/database/db.module';

@Module({
  imports: [DbModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}