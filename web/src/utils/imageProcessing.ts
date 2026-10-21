export type ImageProcessingErrorCode = 'unsupportedType' | 'decodeFailed' | 'tooLarge'

export class ImageProcessingError extends Error {
  constructor(public readonly code: ImageProcessingErrorCode) {
    super(code)
    this.name = 'ImageProcessingError'
  }
}

const START_LONG_EDGE = 2560
const MIN_LONG_EDGE = 1024
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55]
const SHRINK_FACTOR = 0.8

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // Applies EXIF rotation so phone photos don't come out sideways.
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    try {
      return await createImageBitmap(file)
    } catch {
      throw new ImageProcessingError('decodeFailed')
    }
  }
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Validates the type, passes files at or under the limit through untouched, and otherwise
 * resizes and re-encodes as JPEG until the result fits. Throws ImageProcessingError.
 */
export async function prepareImage(
  file: File,
  allowedTypes: readonly string[],
  maxBytes: number,
): Promise<File> {
  if (!allowedTypes.includes(file.type)) throw new ImageProcessingError('unsupportedType')
  if (file.size <= maxBytes) return file

  const bitmap = await decode(file)
  try {
    const sourceEdge = Math.max(bitmap.width, bitmap.height)
    const startEdge = Math.min(sourceEdge, START_LONG_EDGE)
    const floorEdge = Math.min(MIN_LONG_EDGE, startEdge)

    for (let edge = startEdge; edge >= floorEdge; edge = Math.floor(edge * SHRINK_FACTOR)) {
      const scale = edge / sourceEdge
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new ImageProcessingError('decodeFailed')
      // JPEG has no alpha; without this, transparent PNG areas turn black.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      for (const quality of QUALITY_STEPS) {
        const blob = await toJpegBlob(canvas, quality)
        if (blob && blob.size <= maxBytes) {
          return new File([blob], `${file.name.replace(/\.[^/.]+$/, '')}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
        }
      }
    }
    throw new ImageProcessingError('tooLarge')
  } finally {
    bitmap.close()
  }
}



export async function createPreviewUrl(file: File, maxEdge = 1280): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    try {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
      if (blob) return URL.createObjectURL(blob)
    } finally {
      bitmap.close()
    }
  } catch {
    // fall through to the original file
  }
  return URL.createObjectURL(file)
}