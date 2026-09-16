import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { StorageController } from './storage.controller';
import { storageProvider } from './storage.provider';
import { AdminModule } from '../admin/admin.module';
import { isDevelopment } from '../../config/environment';

@Module({
  imports: [
    AdminModule,
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
      },
    }),
    // Local-development convenience only. Staging and production serve media from the
    // storage bucket, never from the container filesystem.
    ...(isDevelopment()
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/static',
            exclude: ['/api/*'],
          }),
        ]
      : []),
  ],
  controllers: [StorageController],
  providers: [storageProvider],
  exports: [storageProvider],
})
export class StorageModule {}

export { StorageService } from './storage.service';
