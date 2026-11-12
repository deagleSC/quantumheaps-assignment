import { useCallback, useEffect, useRef, useState } from 'react'
import { formatBytes, readAsDataUrl, shrinkImage } from '@/shared/lib/files'
import type { Attachment } from '@/types/message.types'

/**
 * 2 MB: queued messages (with their attachment) are saved to localStorage,
 * which only holds ~5 MB per site.
 */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

export interface PendingAttachment {
  file: File
  /** Object URL for the local preview; revoked when no longer needed. */
  previewUrl: string
  isImage: boolean
}

/**
 * The file picked in the composer. Owns the preview object URL: it is
 * revoked when the file is removed, replaced or sent, and on unmount.
 */
export function useAttachment({ onError }: { onError: (message: string) => void }) {
  const [pending, setPending] = useState<PendingAttachment | null>(null)
  const urlRef = useRef<string | null>(null)

  const revoke = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }

  useEffect(() => revoke, [])

  const select = useCallback(
    (file: File | null | undefined) => {
      if (!file) return
      if (file.size > MAX_ATTACHMENT_BYTES) {
        onError(
          `“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
        )
        return
      }
      revoke()
      const previewUrl = URL.createObjectURL(file)
      urlRef.current = previewUrl
      setPending({ file, previewUrl, isImage: file.type.startsWith('image/') })
    },
    [onError],
  )

  const clear = useCallback(() => {
    revoke()
    setPending(null)
  }, [])

  /**
   * Converts the pending file into a message attachment (a data URL, so it
   * survives reloads) and releases the preview URL.
   */
  const take = useCallback(async (): Promise<Attachment | null> => {
    if (!pending) return null
    const { file, isImage } = pending
    const blob = isImage ? await shrinkImage(file) : file
    const attachment: Attachment = {
      name: file.name,
      type: blob.type || file.type || 'application/octet-stream',
      size: blob.size,
      previewUrl: await readAsDataUrl(blob),
    }
    clear()
    return attachment
  }, [pending, clear])

  return { pending, select, clear, take }
}
