/**
 * StorageService — abstract interface for file storage.
 * Implementations: MockStorageService (dev) and GcpStorageService (prod).
 */
export abstract class StorageService {
  /**
   * Upload a file buffer to the given folder and return the public URL.
   * @param buffer    Raw file bytes
   * @param mimeType  e.g. 'image/jpeg'
   * @param filename  Original filename (used for extension)
   * @param folder    Dest folder path, e.g. 'questions/images'
   */
  abstract upload(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    folder: string,
  ): Promise<string>;

  /**
   * Delete a file at the given path.
   * No-op if file does not exist.
   */
  abstract delete(path: string): Promise<void>;
}