import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useLoadOlder } from '../hooks/use-load-older'
import { buildRows, groupIntoSections, type MessageRow } from '../utils/build-rows'
import { registerMessageScroller } from '../utils/message-scroller'
import { HistoryStart } from './history-start'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'

const EMPTY_IDS: string[] = []

/** Above this many rows the list is virtualised (only visible rows are in the DOM). */
export const VIRTUALIZE_AT = 150

type ListRow = MessageRow | { type: 'history'; key: 'history' }

const ESTIMATES: Record<ListRow['type'], number> = {
  history: 56,
  date: 40,
  unread: 36,
  message: 64,
}

function MessageListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading messages" className="space-y-3 p-4">
      {[48, 64, 36, 56, 44, 60].map((w, i) => (
        <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
          <Skeleton className="h-10 rounded-[10px]" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  )
}

function DatePill({ label, floating }: { label: string; floating?: boolean }) {
  return (
    <span
      className={cn(
        'bg-card/95 text-muted-foreground rounded-lg px-3 py-1 text-xs font-medium shadow-(--bubble-shadow) backdrop-blur',
        floating && 'pointer-events-none',
      )}
    >
      {label}
    </span>
  )
}

function UnreadDivider({ count }: { count: number }) {
  return (
    <div
      data-unread-divider
      role="separator"
      className="text-primary my-2 flex items-center gap-3 px-4 text-xs font-medium"
    >
      <span className="bg-primary/30 h-px flex-1" />
      {count} unread {count === 1 ? 'message' : 'messages'}
      <span className="bg-primary/30 h-px flex-1" />
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
  const rows = useMemo<ListRow[]>(
    () => [
      { type: 'history', key: 'history' },
      ...buildRows(messages, { currentUserId, unreadCount }),
    ],
    [messages, currentUserId, unreadCount],
  )
  const isVirtual = rows.length > VIRTUALIZE_AT
  const last = messages[messages.length - 1]
  const typingLabel = getTypingLabel(typingIds, typingUsers)
  const ready = timeline?.status === 'success'
  const hasMore = timeline?.hasMore ?? false
  const olderStatus = timeline?.olderStatus ?? 'idle'

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const prevTotal = useRef(0)

  const virtualizer = useVirtualizer({
    enabled: isVirtual,
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => ESTIMATES[rows[i]?.type ?? 'message'],
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 12,
    onChange: (instance) => {
      // Rows get measured after they render; keep a bottom-pinned view pinned.
      const total = instance.getTotalSize()
      if (total !== prevTotal.current) {
        prevTotal.current = total
        pinIfAtBottom()
      }
    },
  })

  const indexById = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((row, i) => row.type === 'message' && map.set(row.message.id, i))
    return map
  }, [rows])

  const { containerRef, isAtBottom, newCount, scrollToBottom, pinIfAtBottom } = useAutoScroll({
    ready,
    lastMessageId: last?.id,
    lastMessageIsOwn: !!last && last.senderId === currentUserId,
    bottomContentKey: typingLabel,
    initialScroll: () => {
      if (!isVirtual) return false
      const unreadIndex = rows.findIndex((r) => r.type === 'unread')
      if (unreadIndex >= 0) virtualizer.scrollToIndex(unreadIndex, { align: 'center' })
      else virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
      return true
    },
  })

  useLoadOlder({
    containerRef,
    conversationId,
    ready,
    hasMore,
    olderStatus,
    firstMessageId: messages[0]?.id,
  })

  // Reply quotes and search can jump to rows the virtualiser hasn't rendered.
  useEffect(() => {
    if (!isVirtual) return
    return registerMessageScroller((id) => {
      const index = indexById.get(id)
      if (index === undefined) return false
      virtualizer.scrollToIndex(index, { align: 'center' })
      return true
    })
  }, [isVirtual, indexById, virtualizer])

  // Floating date label for the virtualised list (sticky sections don't apply there).
  const dateLabels = useMemo(() => {
    let label = ''
    return rows.map((row) => (row.type === 'date' ? (label = row.label) : label))
  }, [rows])
  const virtualItems = isVirtual ? virtualizer.getVirtualItems() : []
  const [scrollTop, setScrollTop] = useState(0)
  const firstVisible = isVirtual
    ? virtualItems.find((item) => item.end > scrollTop + 8)?.index
    : undefined
  const floatingDate = firstVisible !== undefined ? dateLabels[firstVisible] : ''

  const renderRow = (row: ListRow) => {
    switch (row.type) {
      case 'history':
        return (
          <HistoryStart conversationId={conversationId} hasMore={hasMore} status={olderStatus} />
        )
      case 'date':
        return (
          <div role="separator" className="flex justify-center py-2">
            <DatePill label={row.label} />
          </div>
        )
      case 'unread':
        return <UnreadDivider count={row.count} />
      case 'message':
        return (
          <MessageBubble
            message={row.message}
            isOwn={row.message.senderId === currentUserId}
            isGroup={isGroup}
            isFirstInCluster={row.isFirstInCluster}
            isLastInCluster={row.isLastInCluster}
          />
        )
    }
  }

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
  } else if (isVirtual) {
    body = (
      <div className="mx-auto w-full max-w-4xl py-2">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualItems.map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {renderRow(rows[item.index]!)}
            </div>
          ))}
        </div>
        {typingLabel && <TypingIndicator label={typingLabel} />}
      </div>
    )
  } else {
    const [history, ...messageRows] = rows
    body = (
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end py-2">
        {history && renderRow(history)}
        {groupIntoSections(messageRows as MessageRow[]).map((section) => (
          // One section per day, so each sticky date label only sticks within its day.
          <section key={section.date.key} aria-label={section.date.label}>
            <div role="separator" className="sticky top-2 z-10 flex justify-center py-2">
              <DatePill label={section.date.label} />
            </div>
            {section.rows.map((row) => (
              <div key={row.key}>{renderRow(row)}</div>
            ))}
          </section>
        ))}
        {typingLabel && <TypingIndicator label={typingLabel} />}
      </div>
    )
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={(el) => {
          containerRef.current = el
          scrollRef.current = el
        }}
        onScroll={isVirtual ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
        role="log"
        aria-label="Messages"
        aria-live="polite"
        data-virtualized={isVirtual || undefined}
        className="bg-chat-bg h-full overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        {body}
      </div>
      {isVirtual && floatingDate && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
          <DatePill label={floatingDate} floating />
        </div>
      )}
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
