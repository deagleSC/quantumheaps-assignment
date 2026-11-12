import { Pencil, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useMessageStore, useUiStore } from '@/store'

/** "Editing message" strip above the composer. */
export function EditPreview() {
  const editingId = useUiStore((s) => s.editingId)
  const setEditing = useUiStore((s) => s.setEditing)
  const message = useMessageStore((s) => (editingId ? s.byId[editingId] : undefined))

  if (!message) return null
  return (
    <div className="flex items-center gap-3 border-b px-3 py-2" aria-label="Edit preview">
      <Pencil className="text-primary size-4 shrink-0" aria-hidden />
      <div className="border-primary min-w-0 flex-1 border-l-2 pl-2 text-sm">
        <p className="text-primary text-xs font-semibold">Editing message</p>
        <p className="text-muted-foreground truncate">{message.content}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel edit"
        onClick={() => setEditing(null)}
      >
        <X />
      </Button>
    </div>
  )
}
