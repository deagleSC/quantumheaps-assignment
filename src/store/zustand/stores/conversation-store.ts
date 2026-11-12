import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { AsyncStatus, ConversationId, ISODateString, MessageId } from '@/types/common.types'
import type { Conversation } from '@/types/conversation.types'

export interface ConversationState {
  byId: Record<ConversationId, Conversation>
  /** IDs sorted by most recent activity. */
  order: ConversationId[]
  status: AsyncStatus
  error: string | null
}

export interface ConversationStoreActions {
  setConversations: (conversations: Conversation[]) => void
  upsertConversation: (conversation: Conversation) => void
  patchConversation: (id: ConversationId, patch: Partial<Conversation>) => void
  /** Records new activity and moves the conversation to the top. */
  touchConversation: (id: ConversationId, lastMessageId: MessageId, at: ISODateString) => void
  setUnreadCount: (id: ConversationId, count: number) => void
  incrementUnread: (id: ConversationId) => void
  setStatus: (status: AsyncStatus, error?: string | null) => void
}

export type ConversationStore = ConversationState & ConversationStoreActions

export const initialConversationState: ConversationState = {
  byId: {},
  order: [],
  status: 'idle',
  error: null,
}

const sortOrder = (byId: Record<ConversationId, Conversation>) =>
  Object.values(byId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((c) => c.id)

export const useConversationStore = create<ConversationStore>()(
  devtools(
    immer((set) => ({
      ...initialConversationState,
      setConversations: (conversations) =>
        set((s) => {
          s.byId = Object.fromEntries(conversations.map((c) => [c.id, c]))
          s.order = sortOrder(s.byId)
        }),
      upsertConversation: (conversation) =>
        set((s) => {
          s.byId[conversation.id] = conversation
          s.order = sortOrder(s.byId)
        }),
      patchConversation: (id, patch) =>
        set((s) => {
          const c = s.byId[id]
          if (c) Object.assign(c, patch)
        }),
      touchConversation: (id, lastMessageId, at) =>
        set((s) => {
          const c = s.byId[id]
          if (!c || at < c.updatedAt) return
          c.lastMessageId = lastMessageId
          c.updatedAt = at
          s.order = [id, ...s.order.filter((x) => x !== id)]
        }),
      setUnreadCount: (id, count) =>
        set((s) => {
          const c = s.byId[id]
          if (c) c.unreadCount = count
        }),
      incrementUnread: (id) =>
        set((s) => {
          const c = s.byId[id]
          if (c) c.unreadCount += 1
        }),
      setStatus: (status, error = null) =>
        set((s) => {
          s.status = status
          s.error = error
        }),
    })),
    { name: 'conversation-store' },
  ),
)
