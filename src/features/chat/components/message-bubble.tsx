import { RotateCw } from 'lucide-react'
import { memo } from 'react'
import { OnlineAvatar } from '@/shared/components/online-avatar'
import { Button } from '@/shared/components/ui/button'
import { formatMessageTime } from '@/shared/lib/format-time'
import { cn } from '@/shared/lib/utils'
import { messageActions, useUserStore } from '@/store'
import type { Message } from '@/types/message.types'
import { senderColor } from '../utils/sender-color'
import { MessageStatusIcon } from './message-status-icon'
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
        'flex items-end gap-2 rounded-lg px-3 md:px-4',
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
          className={cn(
            'relative rounded-2xl px-3 py-1.5 text-[15px] leading-snug shadow-sm',
            isOwn
              ? 'bg-bubble-out text-bubble-out-foreground'
              : 'bg-bubble-in text-bubble-in-foreground',
            isLastInCluster && (isOwn ? 'rounded-br-md' : 'rounded-bl-md'),
            message.status === 'failed' && 'opacity-80',
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
          {message.isDeleted ? (
            <p className="italic opacity-70">This message was deleted</p>
          ) : (
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
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

        {message.reactions.length > 0 && (
          <div className={cn('-mt-1 flex flex-wrap gap-1', isOwn ? 'pr-2' : 'pl-2')}>
            {message.reactions.map((r) => (
              <span
                key={r.emoji}
                className="bg-background rounded-full border px-1.5 py-0.5 text-xs shadow-sm"
                aria-label={`${r.emoji} ${r.userIds.length}`}
              >
                {r.emoji}
                {r.userIds.length > 1 && <span className="ml-0.5">{r.userIds.length}</span>}
              </span>
            ))}
          </div>
        )}

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
    </div>
  )
})
