import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { MockStorageService } from './mock-storage.service';
import { GcpStorageService } from './gcp-storage.service';

/**
 * Factory provider that selects the storage implementation based on NODE_ENV.
 *
 * GcpStorageService needs ConfigService injected — NestJS satisfies this
 * automatically when useFactory returns a class instance (Nest detects
 * the constructor parameter and resolves the dependency from its container).
 */
export const storageProvider: Provider<StorageService> = {
  provide: StorageService,
  useFactory(configService: ConfigService): StorageService {
    if (process.env.NODE_ENV === 'production') {
      // GcpStorageService constructor signature matches what Nest expects:
      // constructor(private readonly configService: ConfigService) {}
      return new GcpStorageService(configService);
    }
    return new MockStorageService();
  },
  inject: [ConfigService],
};