import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ConversationId, UserId } from '@/types/common.types'

export interface TypingState {
  /** Who is currently typing in each conversation. */
  byConversation: Record<ConversationId, UserId[]>
}

export interface TypingStoreActions {
  startTyping: (conversationId: ConversationId, userId: UserId) => void
  stopTyping: (conversationId: ConversationId, userId: UserId) => void
}

export type TypingStore = TypingState & TypingStoreActions

export const initialTypingState: TypingState = { byConversation: {} }

export const useTypingStore = create<TypingStore>()(
  devtools(
    (set) => ({
      ...initialTypingState,
      startTyping: (conversationId, userId) =>
        set((s) => {
          const current = s.byConversation[conversationId] ?? []
          if (current.includes(userId)) return s
          return { byConversation: { ...s.byConversation, [conversationId]: [...current, userId] } }
        }),
      stopTyping: (conversationId, userId) =>
        set((s) => {
          const current = s.byConversation[conversationId]
          if (!current?.includes(userId)) return s
          return {
            byConversation: {
              ...s.byConversation,
              [conversationId]: current.filter((id) => id !== userId),
            },
          }
        }),
    }),
    { name: 'typing-store' },
  ),
)
