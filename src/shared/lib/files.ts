/** "1.4 MB", "820 KB", "12 B". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.readAsDataURL(blob)
  })

/** Raster formats worth re-encoding (not GIF animations or SVG). */
const RESIZABLE = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Scales large photos down (longest side ≤ `maxSide`) and re-encodes them as
 * JPEG, so they stay small enough to persist. Returns the original file if
 * it's small, not a photo, or the browser can't decode it.
 */
export async function shrinkImage(
  file: File,
  maxSide = 1600,
  skipBelowBytes = 400_000,
): Promise<Blob> {
  if (!RESIZABLE.includes(file.type) || file.size <= skipBelowBytes) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}
