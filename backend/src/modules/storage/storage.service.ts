/**
 * StorageService — abstract interface for file storage.
 * Implementation: GcpStorageService (Google Cloud Storage via firebase-admin,
 * routes to the local Storage emulator in development, real GCS in production).
 */
export abstract class StorageService {
  /**
   * Upload a file buffer and return its public URL.
   * Files are stored under `{category}/{userId}/{yyyy-mm}/{uuid}_{filename}`.
   *
   * @param buffer    Raw file bytes
   * @param mimeType  e.g. 'image/jpeg', 'audio/mpeg'
   * @param filename  Original filename (used for extension + readable name)
   * @param userId    ID of the uploading user — used to scope the storage path
   * @param category  Top-level content category, e.g. 'questions/images', 'audio'
   */
  abstract upload(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    userId: string,
    category: string,
  ): Promise<string>;

  /**
   * Delete a file at the given path.
   * No-op if file does not exist.
   */
  abstract delete(path: string): Promise<void>;
}