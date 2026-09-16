import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { StorageService, isStorageUri } from "../../../modules/storage/storage.service";

/** Depth cap — responses are plain DTO trees, so this only guards against cycles. */
const MAX_DEPTH = 12;

/**
 * Rewrites persisted `gs://` storage URIs into time-limited signed URLs on the way out.
 *
 * Media is stored as a bucket URI rather than a readable link, so every read path would
 * otherwise have to sign its own URLs. Doing it once at the response boundary keeps the
 * services unaware of signing, and legacy absolute URLs in older records pass through
 * untouched.
 */
@Injectable()
export class SignedUrlInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SignedUrlInterceptor.name);

  constructor(private readonly storageService: StorageService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(mergeMap((body) => this.resolve(body, 0)));
  }

  private async resolve(value: unknown, depth: number): Promise<unknown> {
    if (depth > MAX_DEPTH || value === null || value === undefined) return value;

    if (isStorageUri(value)) {
      try {
        return await this.storageService.getSignedUrl(value);
      } catch (err) {
        // A signing failure must not fail the whole request — the client simply gets
        // an unusable media link for this item.
        this.logger.warn(
          `Failed to sign ${value}: ${(err as Error).message}`,
        );
        return value;
      }
    }

    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => this.resolve(item, depth + 1)));
    }

    // Only walk plain objects — Dates, Buffers and class instances with custom
    // prototypes are returned as-is so nothing is silently reshaped.
    if (this.isPlainObject(value)) {
      const entries = await Promise.all(
        Object.entries(value).map(
          async ([key, item]) =>
            [key, await this.resolve(item, depth + 1)] as const,
        ),
      );
      return Object.fromEntries(entries);
    }

    return value;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) return false;
    const proto = Object.getPrototypeOf(value) as unknown;
    return proto === Object.prototype || proto === null;
  }
}
