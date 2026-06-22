import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StorageService } from './storage.service';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const UPLOADS_DIR = join(process.cwd(), 'uploads');

/**
 * MockStorageService — development-only in-memory + disk storage.
 *
 * Files are written to the `uploads/` directory so ServeStaticModule can
 * serve them at GET /static/{path}. A Map mirrors the same data for fast
 * in-memory lookups and easy delete() implementation.
 *
 * The mock persists across process restarts (files are on disk).
 *
 * For serving uploaded bytes in development, a static route
 * GET /static/{**path} is mounted by ServeStaticModule in app.module.ts.
 */
@Injectable()
export class MockStorageService implements StorageService, OnModuleInit {
  private readonly store = new Map<string, Buffer>();
  private readonly logger = new Logger(MockStorageService.name);

  onModuleInit() {
    // Ensure uploads/ exists before any request hits the controller
    if (!existsSync(UPLOADS_DIR)) {
      mkdirSync(UPLOADS_DIR, { recursive: true });
      this.logger.log(`Created uploads directory: ${UPLOADS_DIR}`);
    }
  }

  async upload(
    buffer: Buffer,
    _mimeType: string,
    filename: string,
    folder: string,
  ): Promise<string> {
    const ext = filename.split('.').pop() ?? 'bin';
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Mirror: in-memory Map (fast) + disk file (for static serving)
    this.store.set(key, buffer);
    const diskPath = join(UPLOADS_DIR, key);
    const diskDir = join(UPLOADS_DIR, folder);
    if (!existsSync(diskDir)) mkdirSync(diskDir, { recursive: true });
    writeFileSync(diskPath, buffer);

    this.logger.debug(`[Mock] Stored ${key} (${buffer.byteLength} bytes)`);
    // Return a relative path — the mobile app resolves this to the correct base URL
    // at render time based on the current environment (simulator, LAN, production).
    return `/static/${key}`;
  }

  async delete(path: string): Promise<void> {
    // Strip host prefix if present
    const key = path.replace(/^https?:\/\/[^/]+\/static\//, '');
    this.store.delete(key);
    const diskPath = join(UPLOADS_DIR, key);
    try { unlinkSync(diskPath); } catch { /* ignore if already gone */ }
    this.logger.debug(`[Mock] Deleted ${key}`);
  }
}