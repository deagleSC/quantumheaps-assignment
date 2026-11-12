import { useMessageStore, useUserStore } from '@/store'
import { cn } from '@/shared/lib/utils'
import type { MessageId } from '@/types/common.types'
import { jumpToMessage } from '../utils/jump-to-message'

export interface ReplyQuoteProps {
  messageId: MessageId
  isOwnBubble: boolean
}

/** The quoted original inside a reply bubble; click to jump to it. */
export function ReplyQuote({ messageId, isOwnBubble }: ReplyQuoteProps) {
  const original = useMessageStore((s) => s.byId[messageId])
  const sender = useUserStore((s) => (original ? s.byId[original.senderId] : undefined))
  const currentUserId = useUserStore((s) => s.currentUserId)

  const name = !original
    ? 'Original message'
    : original.senderId === currentUserId
      ? 'You'
      : (sender?.name ?? 'Unknown')
  const text = !original
    ? 'Not loaded yet'
    : original.isDeleted
      ? 'This message was deleted'
      : original.content || original.attachment?.name

  return (
    <button
      type="button"
      onClick={() => jumpToMessage(messageId)}
      className={cn(
        'mb-1 block w-full rounded-md border-l-4 px-2 py-1 text-left text-xs',
        isOwnBubble ? 'border-bubble-out-foreground/60 bg-black/10' : 'border-primary bg-primary/5',
      )}
    >
      <span className={cn('block font-semibold', !isOwnBubble && 'text-primary')}>{name}</span>
      <span className="line-clamp-2 opacity-80">{text}</span>
    </button>
  )
}
