import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { AsyncStatus, ConversationId, MessageId } from '@/types/common.types'
import type { Message, MessagePage } from '@/types/message.types'

export interface ConversationMessages {
  /** Message IDs in chronological order. */
  ids: MessageId[]
  hasMore: boolean
  status: AsyncStatus
  error: string | null
  olderStatus: AsyncStatus
}

export interface MessageState {
  byId: Record<MessageId, Message>
  /** Present only once a conversation's history has been requested. */
  byConversation: Record<ConversationId, ConversationMessages>
}

export interface MessageStoreActions {
  /** Merges a page of history (initial or older) into the conversation. */
  addPage: (conversationId: ConversationId, page: MessagePage) => void
  /** Adds or updates one message; joins the timeline only if history is loaded. */
  upsertMessage: (message: Message) => void
  /** Stores messages without adding them to a timeline (sidebar previews). */
  cacheMessages: (messages: Message[]) => void
  /** Swaps an optimistic message for the server's copy, keeping its position. */
  replaceMessage: (tempId: MessageId, message: Message) => void
  patchMessage: (id: MessageId, patch: Partial<Message>) => void
  removeMessage: (id: MessageId) => void
  setHistoryStatus: (id: ConversationId, status: AsyncStatus, error?: string | null) => void
  setOlderStatus: (id: ConversationId, status: AsyncStatus) => void
}

export type MessageStore = MessageState & MessageStoreActions

export const initialMessageState: MessageState = { byId: {}, byConversation: {} }

const emptyTimeline = (): ConversationMessages => ({
  ids: [],
  hasMore: false,
  status: 'idle',
  error: null,
  olderStatus: 'idle',
})

/** Unique IDs, sorted by `createdAt` (stable for equal timestamps). */
function mergeIds(byId: Record<MessageId, Message>, ...lists: MessageId[][]): MessageId[] {
  const unique = [...new Set(lists.flat())].filter((id) => byId[id])
  return unique.sort((a, b) => byId[a]!.createdAt.localeCompare(byId[b]!.createdAt))
}

export const useMessageStore = create<MessageStore>()(
  devtools(
    immer((set) => ({
      ...initialMessageState,
      addPage: (conversationId, page) =>
        set((s) => {
          for (const m of page.messages) s.byId[m.id] = m
          const timeline = (s.byConversation[conversationId] ??= emptyTimeline())
          const isFirstPage = timeline.status !== 'success'
          timeline.ids = mergeIds(
            s.byId,
            page.messages.map((m) => m.id),
            timeline.ids,
          )
          // `hasMore` comes from the oldest page we've fetched.
          if (
            isFirstPage ||
            page.messages.length === 0 ||
            timeline.ids[0] === page.messages[0]?.id
          ) {
            timeline.hasMore = page.hasMore
          }
        }),
      upsertMessage: (message) =>
        set((s) => {
          s.byId[message.id] = message
          const timeline = s.byConversation[message.conversationId]
          if (timeline && !timeline.ids.includes(message.id)) {
            timeline.ids = mergeIds(s.byId, timeline.ids, [message.id])
          }
        }),
      cacheMessages: (messages) =>
        set((s) => {
          for (const m of messages) s.byId[m.id] ??= m
        }),
      replaceMessage: (tempId, message) =>
        set((s) => {
          delete s.byId[tempId]
          s.byId[message.id] = message
          const timeline = s.byConversation[message.conversationId]
          if (!timeline) return
          const index = timeline.ids.indexOf(tempId)
          if (index === -1) {
            if (!timeline.ids.includes(message.id)) timeline.ids.push(message.id)
          } else if (timeline.ids.includes(message.id)) {
            timeline.ids.splice(index, 1)
          } else {
            timeline.ids[index] = message.id
          }
        }),
      patchMessage: (id, patch) =>
        set((s) => {
          const m = s.byId[id]
          if (m) Object.assign(m, patch)
        }),
      removeMessage: (id) =>
        set((s) => {
          const m = s.byId[id]
          if (!m) return
          delete s.byId[id]
          const timeline = s.byConversation[m.conversationId]
          if (timeline) timeline.ids = timeline.ids.filter((x) => x !== id)
        }),
      setHistoryStatus: (id, status, error = null) =>
        set((s) => {
          const timeline = (s.byConversation[id] ??= emptyTimeline())
          timeline.status = status
          timeline.error = error
        }),
      setOlderStatus: (id, status) =>
        set((s) => {
          const timeline = (s.byConversation[id] ??= emptyTimeline())
          timeline.olderStatus = status
        }),
    })),
    { name: 'message-store' },
  ),
)
