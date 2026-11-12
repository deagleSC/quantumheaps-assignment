import { ArrowDown, MessageCircle } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { EmptyState } from '@/shared/components/empty-state'
import { ErrorState } from '@/shared/components/error-state'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'
import {
  getTypingLabel,
  messageActions,
  useConversationStore,
  useMessageStore,
  useTypingStore,
  useUiStore,
  useUserStore,
} from '@/store'
import type { ConversationId } from '@/types/common.types'
import type { Message } from '@/types/message.types'
import { useAutoScroll } from '../hooks/use-auto-scroll'
import { buildRows, groupIntoSections } from '../utils/build-rows'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'

const EMPTY_IDS: string[] = []

function MessageListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading messages" className="space-y-3 p-4">
      {[48, 64, 36, 56, 44, 60].map((w, i) => (
        <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
          <Skeleton className="h-10 rounded-2xl" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  )
}

export function MessageList({ conversationId }: { conversationId: ConversationId }) {
  const timeline = useMessageStore((s) => s.byConversation[conversationId])
  const ids = timeline?.ids ?? EMPTY_IDS
  // Shallow-compared array of message objects: unchanged messages keep their
  // identity (immer), so memoised bubbles skip re-rendering.
  const messages = useMessageStore(
    useShallow((s) => ids.map((id) => s.byId[id]).filter((m): m is Message => !!m)),
  )
  const isGroup = useConversationStore((s) => s.byId[conversationId]?.type === 'group')
  const currentUserId = useUserStore((s) => s.currentUserId)
  const unreadMarker = useUiStore((s) => s.unreadMarker)
  const typingIds = useTypingStore((s) => s.byConversation[conversationId] ?? EMPTY_IDS)
  const typingUsers = useUserStore(
    useShallow((s) =>
      Object.fromEntries(typingIds.flatMap((id) => (s.byId[id] ? [[id, s.byId[id]]] : []))),
    ),
  )

  const unreadCount = unreadMarker?.conversationId === conversationId ? unreadMarker.count : 0
  const rows = useMemo(
    () => buildRows(messages, { currentUserId, unreadCount }),
    [messages, currentUserId, unreadCount],
  )
  const sections = useMemo(() => groupIntoSections(rows), [rows])
  const last = messages[messages.length - 1]
  const typingLabel = getTypingLabel(typingIds, typingUsers)
  const ready = timeline?.status === 'success'

  const { containerRef, isAtBottom, newCount, scrollToBottom } = useAutoScroll({
    ready,
    lastMessageId: last?.id,
    lastMessageIsOwn: !!last && last.senderId === currentUserId,
    bottomContentKey: typingLabel,
  })

  let body: React.ReactNode
  if (!timeline || timeline.status === 'loading' || timeline.status === 'idle') {
    body = <MessageListSkeleton />
  } else if (timeline.status === 'error') {
    body = (
      <ErrorState
        title="Couldn't load messages"
        description={timeline.error ?? undefined}
        onRetry={() => void messageActions.loadHistory(conversationId)}
        className="mt-16"
      />
    )
  } else if (messages.length === 0 && !typingLabel) {
    body = (
      <EmptyState
        icon={MessageCircle}
        title="No messages yet"
        description="Say hi to start the conversation 👋"
        className="mt-16"
      />
    )
  } else {
    body = (
      <div className="flex min-h-full flex-col justify-end py-2">
        {sections.map((section) => (
          // One section per day, so each sticky date label only sticks within its day.
          <section key={section.date.key} aria-label={section.date.label}>
            <div role="separator" className="sticky top-2 z-10 flex justify-center py-2">
              <span className="bg-background/90 text-muted-foreground rounded-full border px-3 py-0.5 text-xs font-medium shadow-sm backdrop-blur">
                {section.date.label}
              </span>
            </div>
            {section.rows.map((row) =>
              row.type === 'unread' ? (
                <div
                  key={row.key}
                  data-unread-divider
                  role="separator"
                  className="text-primary my-2 flex items-center gap-3 px-4 text-xs font-medium"
                >
                  <span className="bg-primary/30 h-px flex-1" />
                  {row.count} unread {row.count === 1 ? 'message' : 'messages'}
                  <span className="bg-primary/30 h-px flex-1" />
                </div>
              ) : row.type === 'message' ? (
                <MessageBubble
                  key={row.key}
                  message={row.message}
                  isOwn={row.message.senderId === currentUserId}
                  isGroup={isGroup}
                  isFirstInCluster={row.isFirstInCluster}
                  isLastInCluster={row.isLastInCluster}
                />
              ) : null,
            )}
          </section>
        ))}
        {typingLabel && <TypingIndicator label={typingLabel} />}
      </div>
    )
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        role="log"
        aria-label="Messages"
        aria-live="polite"
        className="bg-chat-bg h-full overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        {body}
      </div>
      {ready && !isAtBottom && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => scrollToBottom(true)}
          className="absolute right-4 bottom-4 rounded-full shadow-md"
          aria-label={
            newCount > 0 ? `${newCount} new messages, scroll to bottom` : 'Scroll to bottom'
          }
        >
          {newCount > 0 && <span className="text-primary font-semibold">{newCount}</span>}
          <ArrowDown />
        </Button>
      )}
    </div>
  )
}
