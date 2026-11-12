import { Download, FileText } from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'
import { formatBytes } from '@/shared/lib/files'
import { cn } from '@/shared/lib/utils'
import type { Attachment } from '@/types/message.types'

/** An attachment inside a bubble: image thumbnail (click to enlarge) or a file chip. */
export function MessageAttachment({
  attachment,
  isOwn,
}: {
  attachment: Attachment
  isOwn: boolean
}) {
  const [open, setOpen] = useState(false)

  if (attachment.type.startsWith('image/')) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open image ${attachment.name}`}
          className="-mx-1.5 mt-0.5 mb-1 block overflow-hidden rounded-xl"
        >
          <img
            src={attachment.previewUrl}
            alt={attachment.name}
            loading="lazy"
            className="max-h-72 w-full max-w-xs object-cover"
          />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[min(90vw,64rem)] p-2 sm:max-w-[min(90vw,64rem)]">
            <DialogTitle className="sr-only">{attachment.name}</DialogTitle>
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <a
      href={attachment.previewUrl}
      download={attachment.name}
      className={cn(
        'mt-0.5 mb-1 flex items-center gap-3 rounded-lg px-2 py-2 text-sm',
        isOwn ? 'bg-black/15 hover:bg-black/20' : 'bg-muted hover:bg-muted/80',
      )}
    >
      <FileText className="size-6 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{attachment.name}</span>
        <span className="block text-xs opacity-75">{formatBytes(attachment.size)}</span>
      </span>
      <Download className="size-4 shrink-0 opacity-75" aria-label="Download" />
    </a>
  )
}
