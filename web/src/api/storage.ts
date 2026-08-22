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

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export interface UploadedAudio {
  /** Public CDN URL of the uploaded audio (Firebase Storage emulator URL in dev). */
  url: string
  /** Original payload size in bytes, as reported by the backend. */
  sizeBytes: number
}

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
    const token = getAccessToken()
    const formData = new FormData()
    // Field name 'file' is required by `FileInterceptor('file')` in
    // `StorageController.uploadAudio`. Do NOT set the Content-Type header
    // manually — the browser sets the correct multipart boundary.
    formData.append('file', audioBlob, filename)

    const res = await fetch(`${BASE}/storage/upload/audio`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
      signal: AbortSignal.timeout(120_000), // audio uploads can be large
    })

    if (!res.ok) {
      let message = `Audio upload failed (${res.status})`
      try {
        const data = await res.json()
        if (data?.message) message = data.message
      } catch {
        /* ignore non-JSON errors */
      }
      throw new Error(message)
    }

    return (await res.json()) as UploadedAudio
  },
}
