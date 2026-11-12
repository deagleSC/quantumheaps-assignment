import { memo } from 'react'
import {
  getConversationDisplay,
  getMessagePreview,
  getTypingLabel,
  useConversationStore,
  useMessageStore,
  useTypingStore,
  useUserStore,
} from '@/store'
import { OnlineAvatar } from '@/shared/components/online-avatar'
import { formatConversationTime } from '@/shared/lib/format-time'
import { cn } from '@/shared/lib/utils'
import type { ConversationId } from '@/types/common.types'

export interface ConversationItemProps {
  id: ConversationId
  isActive: boolean
  onSelect: (id: ConversationId) => void
}

const EMPTY: string[] = []

/**
 * One sidebar row. Subscribes only to its own conversation, peer, last message
 * and typing state, so activity elsewhere doesn't re-render it.
 */
export const ConversationItem = memo(function ConversationItem({
  id,
  isActive,
  onSelect,
}: ConversationItemProps) {
  const conversation = useConversationStore((s) => s.byId[id])
  const lastMessage = useMessageStore((s) =>
    conversation?.lastMessageId ? s.byId[conversation.lastMessageId] : undefined,
  )
  const peer = useUserStore((s) =>
    conversation?.type === 'direct' ? s.byId[conversation.participantId] : undefined,
  )
  const sender = useUserStore((s) => (lastMessage ? s.byId[lastMessage.senderId] : undefined))
  const currentUserId = useUserStore((s) => s.currentUserId)
  const typingIds = useTypingStore((s) => s.byConversation[id] ?? EMPTY)
  const typist = useUserStore((s) => (typingIds[0] ? s.byId[typingIds[0]] : undefined))

  if (!conversation) return null

  const known = { ...(peer && { [peer.id]: peer }), ...(sender && { [sender.id]: sender }) }
  const { title, avatarUrl, isOnline } = getConversationDisplay(conversation, known)
  const typingLabel =
    typingIds.length === 0
      ? null
      : conversation.type === 'direct'
        ? 'typing…'
        : getTypingLabel(typingIds, typist ? { [typist.id]: typist } : {})
  const preview = getMessagePreview(lastMessage, conversation, known, currentUserId)
  const unread = conversation.unreadCount

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'hover:bg-accent focus-visible:ring-ring/50 outline-none focus-visible:ring-2',
        isActive && 'bg-primary/10 hover:bg-primary/15',
      )}
    >
      <OnlineAvatar name={title} src={avatarUrl} isOnline={isOnline} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            data-slot="conversation-title"
            className={cn('truncate', unread > 0 ? 'font-semibold' : 'font-medium')}
          >
            {title}
          </span>
          <time
            dateTime={conversation.updatedAt}
            className={cn(
              'shrink-0 text-xs',
              unread > 0 ? 'text-primary font-medium' : 'text-muted-foreground',
            )}
          >
            {formatConversationTime(conversation.updatedAt)}
          </time>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              typingLabel ? 'text-primary italic' : 'text-muted-foreground',
              lastMessage?.isDeleted && !typingLabel && 'italic',
            )}
          >
            {typingLabel ?? preview}
          </span>
          {unread > 0 && (
            <span
              aria-label={`${unread} unread ${unread === 1 ? 'message' : 'messages'}`}
              className="bg-primary text-primary-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})
