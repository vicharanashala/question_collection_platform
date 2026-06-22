/**
 * Media utility helpers for question submission.
 * Handles compression, duration/size validation, and upload to backend object storage.
 */

import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import {
  VIDEO_MAX_DURATION_SEC,
  VIDEO_MAX_SIZE_MB,
  EDIT_WINDOW_SEC,
} from './constants';

// ─── Constants ────────────────────────────────────────────────────────────────

export { VIDEO_MAX_DURATION_SEC, VIDEO_MAX_SIZE_MB, EDIT_WINDOW_SEC };

// ─── Image helpers ────────────────────────────────────────────────────────────

/**
 * Get file size in MB for a local URI.
 *
 * On iOS, `ph://` photo-library URIs cannot be read by FileSystem —
 * use the `fileSize` field from the image-picker result instead.
 * This function handles the common cases gracefully.
 *
 * Returns 0 if the file cannot be read (unavailable / permission denied / unsupported URI scheme).
 */
export async function getImageSizeMB(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return 0;
    const size = (info as { size?: number }).size;
    if (size == null || size === 0) return 0;
    return size / 1024 / 1024;
  } catch {
    // Thrown for unsupported URI schemes (e.g. ph:// on iOS).
    return 0;
  }
}

/**
 * Compress an image using expo-image-manipulator.
 *
 * - Resizes to max 1280 px on the longest side
 * - JPEG quality 80% (good balance of file size vs. visual quality)
 *
 * Returns the URI of the compressed image (a new temp file).
 */
export async function compressImage(uri: string): Promise<string> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    // Resize: longest side capped at 1280 px
    [{ resize: { width: 1280 } }],
    { compress: 0.8, format: SaveFormat.JPEG },
  );
  return manipResult.uri;
}

/**
 * Upload a local image to backend storage (GCP Nearline).
 * Compresses first if over the size threshold, then uploads.
 *
 * @param uri           Local file URI from image picker
 * @param maxSizeMb     Maximum allowed size in MB (from server /stats endpoint)
 * @param uploadFn      Async function that takes (uri, filename) → { url, sizeBytes }
 *
 * @returns             { tempUri: string } — the URI of the image to use (compressed or original)
 *
 * NOTE: This does NOT return the CDN URL. The caller receives only a local URI
 * (compressed or original). After submit, the backend returns the CDN URL.
 * For a full end-to-end upload-to-permanent-URL flow, use uploadImageToStorage().
 */
export async function prepareAndCompressImage(
  uri: string,
  maxSizeMb = 5,
  uploadFn: (uri: string, filename: string) => Promise<{ url: string; sizeBytes: number }>,
): Promise<{ localUri: string; cdnUrl?: string; sizeBytes: number }> {
  const sizeMb = await getImageSizeMB(uri);

  let localUri = uri;
  if (sizeMb > maxSizeMb) {
    localUri = await compressImage(uri);
  }

  const filename = uri.split('/').pop() ?? `image-${Date.now()}.jpg`;
  const result = await uploadFn(localUri, filename);

  return {
    localUri,
    cdnUrl: result.url,
    sizeBytes: result.sizeBytes,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Check video duration and file size.
 * In Expo (managed workflow), duration is estimated from file size when metadata is unavailable.
 * In bare RN projects, use react-native-video or expo-video to probe actual duration.
 */
export function validateVideo(fileSizeBytes: number, estimatedDurationSec?: number): ValidationResult {
  const maxBytes = VIDEO_MAX_SIZE_MB * 1024 * 1024;

  if (fileSizeBytes > maxBytes) {
    return {
      valid: false,
      error: `Video exceeds ${VIDEO_MAX_SIZE_MB} MB limit (got ${Math.round(fileSizeBytes / 1024 / 1024)} MB). Please compress before submitting.`,
    };
  }

  if (estimatedDurationSec !== undefined && estimatedDurationSec > VIDEO_MAX_DURATION_SEC) {
    return {
      valid: false,
      error: `Video exceeds ${VIDEO_MAX_DURATION_SEC}s limit (got ${estimatedDurationSec}s). Please trim before submitting.`,
    };
  }

  return { valid: true };
}