import { Reply, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useMessageStore, useUiStore, useUserStore } from '@/store'

/** "Replying to …" strip above the composer. */
export function ReplyPreview() {
  const replyingToId = useUiStore((s) => s.replyingToId)
  const setReplyingTo = useUiStore((s) => s.setReplyingTo)
  const message = useMessageStore((s) => (replyingToId ? s.byId[replyingToId] : undefined))
  const sender = useUserStore((s) => (message ? s.byId[message.senderId] : undefined))
  const isOwn = useUserStore((s) => !!message && s.currentUserId === message.senderId)

  if (!message) return null
  return (
    <div className="flex items-center gap-3 border-b px-3 py-2" aria-label="Reply preview">
      <Reply className="text-primary size-4 shrink-0" aria-hidden />
      <div className="border-primary min-w-0 flex-1 border-l-2 pl-2 text-sm">
        <p className="text-primary text-xs font-semibold">
          Replying to {isOwn ? 'yourself' : (sender?.name ?? 'Unknown')}
        </p>
        <p className="text-muted-foreground truncate">{message.content}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel reply"
        onClick={() => setReplyingTo(null)}
      >
        <X />
      </Button>
    </div>
  )
}
