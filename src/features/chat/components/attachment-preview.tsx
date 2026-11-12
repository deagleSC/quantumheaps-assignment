import { FileText, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { formatBytes } from '@/shared/lib/files'
import type { PendingAttachment } from '../hooks/use-attachment'

/** The file waiting to be sent, above the composer input. */
export function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment
  onRemove: () => void
}) {
  const { file, previewUrl, isImage } = attachment
  return (
    <div className="flex items-center gap-3 border-b px-3 py-2" aria-label="Attachment preview">
      {isImage ? (
        <img src={previewUrl} alt={file.name} className="size-14 rounded-md border object-cover" />
      ) : (
        <div className="bg-muted flex size-14 items-center justify-center rounded-md">
          <FileText className="text-muted-foreground size-6" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-medium">{file.name}</p>
        <p className="text-muted-foreground text-xs">{formatBytes(file.size)}</p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Remove attachment" onClick={onRemove}>
        <X />
      </Button>
    </div>
  )
}
