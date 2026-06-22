import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { StorageController } from './storage.controller';
import { storageProvider } from './storage.provider';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    AdminModule,
    // Serve mock uploads at /static/{path} in development.
    // In production this is unused (GcpStorageService returns real GCS URLs).
    ...(process.env.NODE_ENV !== 'production'
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

// Re-export StorageService for convenience
export { StorageService } from './storage.service';