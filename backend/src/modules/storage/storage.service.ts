/**
 * StorageService — abstract interface for file storage.
 *
 * Implementation: GcpStorageService (native @google-cloud/storage). Objects live in a
 * private Google Cloud Storage bucket, namespaced per environment, and are never
 * publicly readable. Local development talks to the Firebase Storage emulator through
 * the same client.
 *
 * Uploads return a `gs://bucket/object` URI — that is what gets persisted. A readable
 * URL is minted on demand via getSignedUrl(), so a leaked URL stops working once it
 * expires.
 */
export interface StoredObjectStream {
  stream: NodeJS.ReadableStream;
  contentType: string;
  /** Total object size in bytes. */
  size: number;
  /** Inclusive byte range being served; set only for partial responses. */
  range?: { start: number; end: number };
}

export abstract class StorageService {
  /**
   * Upload a file buffer and return its `gs://bucket/object` URI.
   * Objects are stored under `{prefix}/{category}/{userId}/{yyyy-MM}/{uuid}_{filename}`.
   *
   * @param buffer    Raw file bytes
   * @param mimeType  e.g. 'image/jpeg', 'audio/mpeg'
   * @param filename  Original filename (used for extension + readable name)
   * @param userId    ID of the uploading user — used to scope the storage path
   * @param category  Top-level content category, e.g. 'audios', 'images'
   */
  abstract upload(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    userId: string,
    category: string,
  ): Promise<string>;

  /**
   * Delete a file. Accepts a `gs://` URI or a legacy absolute storage URL.
   * No-op if the file does not exist.
   */
  abstract delete(path: string): Promise<void>;

  /**
   * Mint a time-limited readable URL for a `gs://` URI.
   * Returns the input unchanged if it is not a URI this service owns.
   */
  abstract getSignedUrl(uri: string): Promise<string>;

  /**
   * Open a stored object for streaming after validating a URL minted by getSignedUrl().
   * Throws ForbiddenException for a bad or expired signature and NotFoundException when
   * the object is missing. `range` is an optional HTTP Range header value.
   */
  abstract openSignedObject(
    objectName: string,
    expires: number,
    signature: string,
    range?: string,
  ): Promise<StoredObjectStream>;

  /**
   * Normalise a readable URL that points at this bucket back into its `gs://` URI so it
   * can be persisted. Used when a client echoes an upload response back to the API.
   * Values that do not belong to this bucket are returned unchanged.
   */
  abstract toStorageUri(value: string): string;
}

/** True when a persisted media value is a storage URI that needs signing before use. */
export function isStorageUri(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("gs://");
}
