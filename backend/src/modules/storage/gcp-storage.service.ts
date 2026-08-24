// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { StorageService } from './storage.service';

// // Lazy-load the heavy GCP SDK only when actually instantiated in production.
// type StorageClient = InstanceType<typeof import('@google-cloud/storage').Storage>;
// let Storage: typeof import('@google-cloud/storage').Storage | null = null;

// async function loadStorageClient() {
//   if (!Storage) {
//     const mod = await import('@google-cloud/storage');
//     Storage = mod.Storage;
//   }
//   return Storage;
// }

// @Injectable()
// export class GcpStorageService implements StorageService {
//   private readonly logger = new Logger(GcpStorageService.name);
//   private bucketName: string;
//   private storageClient: StorageClient | null = null;

//   constructor(private readonly configService: ConfigService) {
//     this.bucketName = this.configService.get<string>('gcpStorage.bucketName') ?? '';
//   }

//   async onModuleInit() {
//     const keyFile = this.configService.get<string>('gcpStorage.keyFile');
//     const projectId = this.configService.get<string>('gcpStorage.projectId');
//     if (!projectId) {
//       throw new Error('gcpStorage.projectId is not configured — set GCP_PROJECT_ID in .env');
//     }

//     const storageOpts: Record<string, string> = { projectId };
//     if (keyFile) storageOpts.keyFilename = keyFile;

//     const StorageClass = await loadStorageClient();
//     this.storageClient = new StorageClass(storageOpts);
//     this.logger.log(`GCP Storage initialised — bucket: ${this.bucketName}`);
//   }

//   private async getBucket() {
//     if (!this.storageClient) {
//       await this.onModuleInit();
//     }
//     return this.storageClient!.bucket(this.bucketName);
//   }

//   async upload(
//     buffer: Buffer,
//     mimeType: string,
//     filename: string,
//     folder: string,
//   ): Promise<string> {
//     const ext = filename.split('.').pop() ?? 'bin';
//     const blobName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

//     const bucket = await this.getBucket();
//     const file = bucket.file(blobName);

//     // GCP Nearline = 'NEARLINE' storage class; 30-day minimum retention
//     await file.save(buffer, {
//       contentType: mimeType,
//       metadata: {
//         cacheControl: 'private, max-age=86400',
//       },
//       resumable: false,
//     });

//     // Set Nearline storage class after save
//     await file.setMetadata({ storageClass: 'NEARLINE' });

//     // Make publicly readable
//     await file.makePublic();

//     // Returns the public CDN URL
//     const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${blobName}`;
//     this.logger.debug(`[GCP] Uploaded ${blobName} → ${publicUrl}`);
//     return publicUrl;
//   }

//   async delete(path: string): Promise<void> {
//     // Extract blob name from full GCS URL
//     const blobName = path.replace(/^https?:\/\/storage\.googleapis\.com\/[^\/]+\//, '');
//     try {
//       const bucket = await this.getBucket();
//       await bucket.file(blobName).delete();
//       this.logger.debug(`[GCP] Deleted ${blobName}`);
//     } catch (err: unknown) {
//       // Ignore 404 — file already gone
//       const e = err as { code?: number };
//       if (e.code === 404) return;
//       throw err;
//     }
//   }
// }

import { Injectable, Logger } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { FirebaseService } from "./firebase.service";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class GcpStorageService implements StorageService {
  private readonly logger = new Logger(GcpStorageService.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  private get bucket() {
    return this.firebaseService.getStorageBucket();
  }

async upload(
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
  userId: string,
  category: string,
): Promise<string> {
  const yyyyMm = new Date().toISOString().slice(0, 7);
  const ext = originalFilename.split('.').pop() ?? 'bin';
  const base = originalFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
  const blobName = `${category}/${userId}/${yyyyMm}/${uuidv4()}_${base}.${ext}`;

  const file = this.bucket.file(blobName);
  await file.save(buffer, {
    contentType: mimeType,
    metadata: { cacheControl: 'private, max-age=86400' },
    resumable: false,
  });

  if (!this.firebaseService.isEmulator) {
    await file.setMetadata({ storageClass: 'NEARLINE' });
    await file.makePublic();
  }

  const publicUrl = this.firebaseService.isEmulator
    ? `http://${this.firebaseService.emulatorHost}/v0/b/${this.bucket.name}/o/${encodeURIComponent(blobName)}?alt=media`
    : `https://storage.googleapis.com/${this.bucket.name}/${blobName}`;

  this.logger.debug(`[GCP${this.firebaseService.isEmulator ? ':emu' : ''}] Uploaded ${blobName} → ${publicUrl}`);
  return publicUrl;
}

  async delete(path: string): Promise<void> {
    const blobName = this.firebaseService.isEmulator
      ? decodeURIComponent(path.split("/o/")[1]?.split("?")[0] ?? "")
      : path.replace(/^https?:\/\/storage\.googleapis\.com\/[^/]+\//, "");

    try {
      await this.bucket.file(blobName).delete();
      this.logger.debug(`[GCP] Deleted ${blobName}`);
    } catch (err: unknown) {
      const e = err as { code?: number };
      if (e.code === 404) return;
      throw err;
    }
  }
}
