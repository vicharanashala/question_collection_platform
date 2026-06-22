import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { StorageController } from './storage.controller';
import { storageProvider } from './storage.provider';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    AdminModule,
    // Multer processes multipart/form-data for the storage upload endpoint.
    // Size/file-type enforcement is done in the controller via AdminService.
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB cap (controller enforces actual limit via DB config)
        files: 1,
      },
    }),
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