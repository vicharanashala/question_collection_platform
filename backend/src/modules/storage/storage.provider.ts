import { Provider } from '@nestjs/common';
import { StorageService } from './storage.service';
import { GcpStorageService } from './gcp-storage.service';

/**
 * Single storage implementation across all environments. GcpStorageService targets the
 * Firebase Storage emulator in local development and the real GCS bucket in staging and
 * production, so the upload path is identical everywhere.
 */
export const storageProvider: Provider<StorageService> = {
  provide: StorageService,
  useClass: GcpStorageService,
};
