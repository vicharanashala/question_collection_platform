/**
 * Media utility helpers for question submission.
 * Handles compression, duration/size validation, and mock upload to object storage.
 *
 * NOTE: These are client-side helpers only. The actual upload to object storage (e.g. S3,
 * Cloudflare R2, GCS) requires presigned URLs from the backend. This module provides
 * the compression pipeline and returns local file URIs that are then exchanged for
 * permanent URLs via the backend's media upload endpoint.
 */

import { Platform } from 'react-native';
import {
  VIDEO_MAX_DURATION_SEC,
  VIDEO_MAX_SIZE_MB,
  EDIT_WINDOW_SEC,
} from './constants';

// ─── Constants ────────────────────────────────────────────────────────────────

export { VIDEO_MAX_DURATION_SEC, VIDEO_MAX_SIZE_MB, EDIT_WINDOW_SEC };

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

/**
 * Estimate compression quality for an image given target size.
 * Returns a quality value 0–1 for use with image editors / custom compression.
 */
export function estimateJpegQuality(currentSizeMb: number, targetMb = 1): number {
  if (currentSizeMb <= targetMb) return 1.0;
  return Math.max(0.1, targetMb / currentSizeMb);
}

// ─── Mock object storage upload ───────────────────────────────────────────────

/**
 * Mock upload to object storage (placeholder).
 * Real implementation:
 *  1. POST /media/presign  →  get presigned PUT URL
 *  2. PUT to presigned URL with file binary
 *  3. Return the public URL from the response
 */
export async function uploadToStorage(
  localUri: string,
  _mediaType: 'image' | 'video' | 'audio',
  _userId: string,
): Promise<string> {
  // Simulate upload latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Return a mock CDN URL — replace with real URL after upload
  const filename = localUri.split('/').pop() ?? 'media';
  const timestamp = Date.now();
  return `https://cdn.example.com/media/${timestamp}-${filename}`;
}

/**
 * Compress image before upload (placeholder).
 * In a real app, use react-native-image-resizer or expo-image-manipulator:
 *
 *   import ImageResizer from 'react-native-image-resizer';
 *   const resized = await ImageResizer.createResizedImage(
 *     uri, width, height, 'JPEG', 80, 0, undefined, false,
 *   );
 *   return resized.uri;
 */
export async function compressImage(uri: string, quality = 0.8): Promise<string> {
  console.log(`[Media] Compress image at ${uri} with quality ${quality}`);
  // TODO(abiram): replace with real implementation
  return uri;
}

/**
 * Compress video before upload (placeholder).
 * In a real app, use react-native-video-processing or FFmpeg:
 *
 *   import { compressVideo } from '@react-native-camera-roll/video-processing';
 *   return await compressVideo(uri, { bitrate: 1_000_000, minimumBitrate: 500_000 });
 */
export async function compressVideo(uri: string): Promise<string> {
  console.log(`[Media] Compress video at ${uri}`);
  // TODO(abiram): replace with real implementation
  return uri;
}