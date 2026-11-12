import { useMemo } from 'react'
import {
  filterConversations,
  useConversationStore,
  useMessageStore,
  useUiStore,
  useUserStore,
} from '@/store'

/** Conversation IDs for the sidebar after the active tab and search are applied. */
export function useFilteredConversations() {
  const order = useConversationStore((s) => s.order)
  const byId = useConversationStore((s) => s.byId)
  const usersById = useUserStore((s) => s.byId)
  const messagesById = useMessageStore((s) => s.byId)
  const filter = useUiStore((s) => s.filter)
  const search = useUiStore((s) => s.search)

  return useMemo(
    () => filterConversations({ order, byId, usersById, messagesById, filter, search }),
    [order, byId, usersById, messagesById, filter, search],
  )
}
