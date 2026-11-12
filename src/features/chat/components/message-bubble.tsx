import { RotateCw } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { OnlineAvatar } from '@/shared/components/online-avatar'
import { Button } from '@/shared/components/ui/button'
import { useLongPress } from '@/shared/hooks/use-long-press'
import { formatMessageTime } from '@/shared/lib/format-time'
import { cn } from '@/shared/lib/utils'
import { messageActions, useUiStore, useUserStore } from '@/store'
import type { Message } from '@/types/message.types'
import { messageMatches } from '../utils/highlight'
import { senderColor } from '../utils/sender-color'
import { HighlightedText } from './highlighted-text'
import { MessageActions } from './message-actions'
import { MessageAttachment } from './message-attachment'
import { MessageStatusIcon } from './message-status-icon'
import { ReactionChips } from './reaction-chips'
import { ReplyQuote } from './reply-quote'

export interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  /** Group chats show sender names and avatars. */
  isGroup: boolean
  isFirstInCluster: boolean
  isLastInCluster: boolean
}

/** One message. Memoised: re-renders only when its own message object changes. */
export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  isGroup,
  isFirstInCluster,
  isLastInCluster,
}: MessageBubbleProps) {
  const sender = useUserStore((s) => (isGroup && !isOwn ? s.byId[message.senderId] : undefined))
  const currentUserId = useUserStore((s) => s.currentUserId)
  // Only bubbles that match the in-chat search subscribe to the query.
  const searchQuery = useUiStore((s) =>
    s.messageSearch && messageMatches(message, s.messageSearch.query) ? s.messageSearch.query : '',
  )
  const isActiveMatch = useUiStore((s) => s.messageSearch?.activeMatchId === message.id)
  const [menuOpen, setMenuOpen] = useState(false)
  const openMenu = useCallback(() => setMenuOpen(true), [])
  const longPress = useLongPress(openMenu)

  if (message.kind === 'system') {
    return (
      <div className="flex justify-center px-4 py-1.5">
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs">
          {message.content}
        </span>
      </div>
    )
  }

  const showAvatar = isGroup && !isOwn
  const time = formatMessageTime(message.createdAt)

  return (
    <div
      data-message-id={message.id}
      className={cn(
        'group/message flex items-end gap-2 rounded-lg px-3 md:px-4',
        isOwn ? 'justify-end' : 'justify-start',
        isFirstInCluster ? 'pt-2' : 'pt-0.5',
      )}
    >
      {showAvatar && (
        <div className="w-8 shrink-0">
          {isLastInCluster && sender && (
            <OnlineAvatar name={sender.name} src={sender.avatarUrl} size="sm" />
          )}
        </div>
      )}
      <div className={cn('flex max-w-[85%] flex-col sm:max-w-[70%]', isOwn && 'items-end')}>
        <div
          {...(message.kind === 'text' && !message.isDeleted ? longPress : {})}
          onContextMenu={(e) => {
            if (message.isDeleted) return
            e.preventDefault()
            openMenu()
          }}
          className={cn(
            'relative rounded-[10px] px-2.5 py-1.5 text-[15px] leading-snug shadow-(--bubble-shadow)',
            '[@media(hover:none)]:select-none',
            isOwn
              ? 'bg-bubble-out text-bubble-out-foreground'
              : 'bg-bubble-in text-bubble-in-foreground',
            isLastInCluster && (isOwn ? 'rounded-br-[3px]' : 'rounded-bl-[3px]'),
            message.status === 'failed' && 'opacity-80',
            isActiveMatch && 'ring-offset-chat-bg ring-2 ring-amber-400 ring-offset-2',
          )}
        >
          {showAvatar && isFirstInCluster && (
            <p className={cn('mb-0.5 text-xs font-semibold', senderColor(message.senderId))}>
              {sender?.name ?? 'Unknown'}
            </p>
          )}
          {message.replyToId && !message.isDeleted && (
            <ReplyQuote messageId={message.replyToId} isOwnBubble={isOwn} />
          )}
          {message.attachment && !message.isDeleted && (
            <MessageAttachment attachment={message.attachment} isOwn={isOwn} />
          )}
          {message.isDeleted ? (
            <p className="italic opacity-70">This message was deleted</p>
          ) : (
            message.content && (
              <p className="break-words whitespace-pre-wrap">
                <HighlightedText text={message.content} query={searchQuery} />
              </p>
            )
          )}
          <span
            className={cn(
              'float-right mt-1 ml-3 flex translate-y-0.5 items-center gap-1 text-[11px] leading-none select-none',
              isOwn ? 'text-bubble-out-foreground/75' : 'text-muted-foreground',
            )}
          >
            {message.editedAt && !message.isDeleted && <span>edited</span>}
            <time dateTime={message.createdAt}>{time}</time>
            {isOwn && !message.isDeleted && <MessageStatusIcon status={message.status} />}
          </span>
        </div>

        <ReactionChips
          reactions={message.reactions}
          align={isOwn ? 'end' : 'start'}
          disabled={message.isDeleted}
          onToggle={(emoji) => void messageActions.toggleReaction(message.id, emoji)}
        />

        {message.status === 'failed' && (
          <Button
            variant="link"
            size="xs"
            className="text-destructive h-auto px-0 pt-1"
            onClick={() => void messageActions.retry(message.id)}
          >
            <RotateCw /> Not sent. Tap to retry
          </Button>
        )}
      </div>
      <MessageActions
        message={message}
        isOwn={isOwn}
        currentUserId={currentUserId}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
      />
    </div>
  )
})
