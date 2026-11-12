import { Inbox, SearchX } from 'lucide-react'
import { useCallback } from 'react'
import { EmptyState } from '@/shared/components/empty-state'
import { ErrorState } from '@/shared/components/error-state'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { conversationActions, useConversationStore, useUiStore } from '@/store'
import type { ConversationId } from '@/types/common.types'
import { useFilteredConversations } from '../hooks/use-filtered-conversations'
import { ConversationItem } from './conversation-item'

const EMPTY_COPY = {
  all: { title: 'No chats yet', description: 'Conversations will show up here.' },
  unread: { title: 'All caught up', description: 'You have no unread chats.' },
  groups: { title: 'No groups', description: 'Group chats you join show up here.' },
} as const

export function ConversationListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading chats" className="space-y-1 px-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ConversationList() {
  const status = useConversationStore((s) => s.status)
  const error = useConversationStore((s) => s.error)
  const filter = useUiStore((s) => s.filter)
  const search = useUiStore((s) => s.search)
  const activeId = useUiStore((s) => s.activeConversationId)
  const ids = useFilteredConversations()

  const onSelect = useCallback((id: ConversationId) => void conversationActions.open(id), [])

  if (status === 'idle' || (status === 'loading' && ids.length === 0)) {
    return <ConversationListSkeleton />
  }
  if (status === 'error') {
    return (
      <ErrorState
        title="Couldn't load chats"
        description={error ?? undefined}
        onRetry={() => void conversationActions.loadInbox()}
      />
    )
  }
  if (ids.length === 0) {
    return search.trim() ? (
      <EmptyState
        icon={SearchX}
        title="No chats match"
        description={`Nothing found for “${search.trim()}”.`}
      />
    ) : (
      <EmptyState icon={Inbox} {...EMPTY_COPY[filter]} />
    )
  }

  return (
    <ul aria-label="Chats" className="space-y-0.5 px-2 pb-2">
      {ids.map((id) => (
        <li key={id}>
          <ConversationItem id={id} isActive={id === activeId} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}
