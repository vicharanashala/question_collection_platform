import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage, Bucket } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";
import { StorageService } from "./storage.service";
import { isDevelopment } from "../../config/environment";

/** Cached signed URL, re-used until shortly before the signature expires. */
interface SignedUrlCacheEntry {
  url: string;
  expiresAt: number;
}

/**
 * Google Cloud Storage backend.
 *
 * The same upload/download code runs everywhere; only the client target changes:
 *   • local development  → Firebase Storage emulator (FIREBASE_STORAGE_EMULATOR_HOST)
 *   • staging/production → real GCS bucket, authenticated via Application Default
 *     Credentials (the Cloud Run runtime service account)
 *
 * Objects are private. Readable URLs are V4-signed on demand and cached in memory for
 * just under their lifetime, so a list endpoint does not re-sign the same object on
 * every request.
 */
@Injectable()
export class GcpStorageService implements StorageService, OnModuleInit {
  private readonly logger = new Logger(GcpStorageService.name);
  private readonly signedUrlCache = new Map<string, SignedUrlCacheEntry>();

  private client!: Storage;
  private bucketName!: string;
  private prefix!: string;
  private storageClass!: string;
  private signedUrlTtlSeconds!: number;
  private emulatorHost = "";

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.bucketName =
      this.configService.get<string>("gcpStorage.bucketName") ?? "";
    this.prefix = (
      this.configService.get<string>("gcpStorage.prefix") ?? ""
    ).replace(/^\/+|\/+$/g, "");
    this.storageClass =
      this.configService.get<string>("gcpStorage.storageClass") ?? "NEARLINE";
    this.signedUrlTtlSeconds =
      this.configService.get<number>("gcpStorage.signedUrlTtlSeconds") ??
      7 * 24 * 60 * 60;

    const projectId = this.configService.get<string>("gcpStorage.projectId");
    const keyFile = this.configService.get<string>("gcpStorage.keyFile");
    const configuredEmulator =
      this.configService.get<string>("gcpStorage.emulatorHost") ?? "";

    if (!this.bucketName) {
      throw new Error(
        "gcpStorage.bucketName is not configured — set GCP_BUCKET_NAME.",
      );
    }
    if (!this.prefix) {
      throw new Error(
        "gcpStorage.prefix is not configured — set GCP_STORAGE_PREFIX so staging and production objects stay separated.",
      );
    }
    if (configuredEmulator && !isDevelopment()) {
      throw new Error(
        "FIREBASE_STORAGE_EMULATOR_HOST is set outside development — refusing to start.",
      );
    }

    if (configuredEmulator) {
      this.emulatorHost = this.normaliseEmulatorHost(configuredEmulator);
      // The GCS client reads this env var natively and then skips credential lookup.
      process.env.STORAGE_EMULATOR_HOST = this.emulatorHost;
      this.client = new Storage({
        apiEndpoint: this.emulatorHost,
        projectId: projectId || "demo-question-collection-project",
      });
      this.logger.log(
        `Storage initialised against emulator ${this.emulatorHost} — bucket ${this.bucketName}/${this.prefix}`,
      );
      return;
    }

    // Application Default Credentials. On Cloud Run this resolves to the service
    // account attached to the revision; GCP_KEY_FILE is only for local/VM use.
    this.client = new Storage({
      ...(projectId ? { projectId } : {}),
      ...(keyFile ? { keyFilename: keyFile } : {}),
    });
    this.logger.log(
      `Storage initialised — bucket ${this.bucketName}/${this.prefix}`,
    );
  }

  private get bucket(): Bucket {
    return this.client.bucket(this.bucketName);
  }

  private get isEmulator(): boolean {
    return Boolean(this.emulatorHost);
  }

  // Emulator hosts are configured with or without a scheme; the SDK needs one.
  private normaliseEmulatorHost(host: string): string {
    const withScheme = /^https?:\/\//.test(host) ? host : `http://${host}`;
    return withScheme.replace(/\/+$/, "");
  }

  async upload(
    buffer: Buffer,
    mimeType: string,
    originalFilename: string,
    userId: string,
    category: string,
  ): Promise<string> {
    const yyyyMm = new Date().toISOString().slice(0, 7);
    const ext = originalFilename.split(".").pop() ?? "bin";
    const base = originalFilename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "_");
    const objectName = `${this.prefix}/${category}/${userId}/${yyyyMm}/${uuidv4()}_${base}.${ext}`;

    const file = this.bucket.file(objectName);
    await file.save(buffer, {
      contentType: mimeType,
      metadata: { cacheControl: "private, max-age=86400" },
      resumable: false,
    });

    // The emulator does not implement storage classes.
    if (!this.isEmulator) {
      await file.setStorageClass(this.storageClass);
    }

    const uri = `gs://${this.bucketName}/${objectName}`;
    this.logger.debug(`Uploaded ${objectName}`);
    return uri;
  }

  async delete(path: string): Promise<void> {
    const objectName = this.toObjectName(path);
    if (!objectName) return;

    try {
      await this.bucket.file(objectName).delete();
      this.signedUrlCache.delete(objectName);
      this.logger.debug(`Deleted ${objectName}`);
    } catch (err: unknown) {
      const e = err as { code?: number };
      if (e.code === 404) return;
      throw err;
    }
  }

  async getSignedUrl(uri: string): Promise<string> {
    const objectName = this.toObjectName(uri);
    if (!objectName) return uri;

    // The emulator has no signing endpoint — its download URL is used directly.
    if (this.isEmulator) {
      return `${this.emulatorHost}/v0/b/${this.bucketName}/o/${encodeURIComponent(objectName)}?alt=media`;
    }

    const cached = this.signedUrlCache.get(objectName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    const expiresAtMs = Date.now() + this.signedUrlTtlSeconds * 1000;
    const [url] = await this.bucket.file(objectName).getSignedUrl({
      version: "v4",
      action: "read",
      expires: expiresAtMs,
    });

    // Expire the cache entry a minute early so a URL is never handed out as it lapses.
    this.signedUrlCache.set(objectName, {
      url,
      expiresAt: expiresAtMs - 60_000,
    });
    return url;
  }

  toStorageUri(value: string): string {
    if (typeof value !== "string" || value.startsWith("gs://")) return value;
    const objectName = this.toObjectName(value);
    return objectName ? `gs://${this.bucketName}/${objectName}` : value;
  }

  /**
   * Resolve any supported reference to a bucket-relative object name, or null when the
   * value does not belong to this bucket. Accepts gs:// URIs, signed and public
   * storage.googleapis.com URLs, and emulator download URLs.
   */
  private toObjectName(value: string): string | null {
    if (typeof value !== "string" || !value) return null;

    if (value.startsWith(`gs://${this.bucketName}/`)) {
      return value.slice(`gs://${this.bucketName}/`.length);
    }
    if (value.startsWith("gs://")) return null;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return null;
    }

    // Emulator: /v0/b/{bucket}/o/{urlEncodedObject}
    const emulatorMatch = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (emulatorMatch) {
      return emulatorMatch[1] === this.bucketName
        ? decodeURIComponent(emulatorMatch[2])
        : null;
    }

    // Public or signed GCS URL: /{bucket}/{object} on storage.googleapis.com
    const gcsMatch = parsed.pathname.match(/^\/([^/]+)\/(.+)$/);
    if (
      gcsMatch &&
      parsed.hostname === "storage.googleapis.com" &&
      gcsMatch[1] === this.bucketName
    ) {
      return decodeURIComponent(gcsMatch[2]);
    }

    // Virtual-hosted style: {bucket}.storage.googleapis.com/{object}
    if (parsed.hostname === `${this.bucketName}.storage.googleapis.com`) {
      return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    }

    return null;
  }
}
