/**
 * Storage API (browser).
 *
 * Mirrors the mobile `storageApi.uploadAudio()` helper so the web client
 * can persist recorded audio to Google Cloud Storage (Nearline) the same
 * way the mobile client does. The audio is uploaded first, then the
 * resulting URL is stored alongside the question for archival / replay.
 *
 * Backend:
 *   POST /storage/upload/audio   → { url: string, sizeBytes: number }
 *
 * Field name on the multipart body MUST be `file` (matches the backend's
 * `FileInterceptor('file')` in `StorageController.uploadAudio`).
 */
import { getAccessToken } from './client'
import type { AgriEntityType } from '@/types'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export interface UploadedFile {
  /** Signed URL of the uploaded file (Firebase Storage emulator URL in dev). */
  url: string
  /** Original payload size in bytes, as reported by the backend. */
  sizeBytes: number
}

export type UploadedAudio = UploadedFile

export const storageApi = {
  /**
   * Upload a recorded audio blob to backend storage (GCP Nearline in
   * production; Firebase Storage emulator in development).
   *
   * Mirrors the mobile `storageApi.uploadAudio(uri, filename)` but accepts
   * a `Blob` directly (since the browser's `MediaRecorder` produces a Blob
   * with no URI of its own).
   *
   * @param audioBlob  Browser-recorded audio blob (from MediaRecorder)
   * @param filename   Filename to send with the multipart payload
   *                   (e.g. 'recording.webm' or 'recording.mp4'). The
   *                   extension helps the backend derive the MIME type.
   * @returns          Permanent CDN URL + byte count
   */
  async uploadAudio(audioBlob: Blob, filename = 'recording.webm'): Promise<UploadedAudio> {
    // Audio uploads can be large, so they get a longer timeout.
    return uploadFile('/storage/upload/audio', audioBlob, filename, 120_000, 'Audio upload failed')
  },

  /**
   * Upload one image for a crop, weed, pest or disease submission. The backend
   * stores it under {env}/agri-entities/{type}s/{userId}/{yyyy-MM}/ and returns
   * a signed URL that the submit endpoint converts back to its storage URI.
   */
  async uploadAgriEntityImage(image: Blob, type: AgriEntityType, filename: string): Promise<UploadedFile> {
    const path = `/storage/upload/agri-entity-image?type=${encodeURIComponent(type)}`
    return uploadFile(path, image, filename, 60_000, 'Image upload failed')
  },
}

// Posts a single file as multipart form data and surfaces the backend's error message on failure.
async function uploadFile(
  path: string,
  file: Blob,
  filename: string,
  timeoutMs: number,
  fallbackError: string,
): Promise<UploadedFile> {
  const token = getAccessToken()
  const formData = new FormData()
  // Field name 'file' is required by `FileInterceptor('file')` in the storage
  // controller. Do NOT set the Content-Type header manually — the browser sets
  // the correct multipart boundary.
  formData.append('file', file, filename)

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    let message = `${fallbackError} (${res.status})`
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      /* ignore non-JSON errors */
    }
    throw new Error(message)
  }

  return (await res.json()) as UploadedFile
}
