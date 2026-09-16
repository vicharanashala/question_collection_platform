import { Transform } from "class-transformer";
import { INestApplication } from "@nestjs/common";
import { StorageService } from "../../../modules/storage/storage.service";

declare global {
  // eslint-disable-next-line no-var
  var nestApp: INestApplication | undefined;
}

/**
 * Normalises media links a client echoes back into the `gs://` URIs that get persisted.
 *
 * Upload responses carry signed URLs, which expire. Storing one would leave a dead link
 * in the database, so any URL pointing at our own bucket is converted back to its
 * storage URI here. Values from anywhere else are left untouched.
 *
 * class-transformer runs outside the DI container, so StorageService is resolved from
 * the application reference main.ts publishes on globalThis.
 */
export function NormalizeMediaUrls(): PropertyDecorator {
  return Transform(({ value }) => {
    if (!Array.isArray(value)) return value;

    const app = globalThis.nestApp;
    if (!app) return value;

    try {
      const storageService = app.get(StorageService, { strict: false });
      return value.map((item) =>
        typeof item === "string" ? storageService.toStorageUri(item) : item,
      );
    } catch {
      // Storage not resolvable (e.g. during early bootstrap) — persist as provided.
      return value;
    }
  });
}
