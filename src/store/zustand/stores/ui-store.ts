import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import type { ConversationId, MessageId, ThemePreference } from '@/types/common.types'
import type { ConversationFilter } from '@/types/conversation.types'

export interface UiState {
  activeConversationId: ConversationId | null
  filter: ConversationFilter
  search: string
  replyingToId: MessageId | null
  editingId: MessageId | null
  isInfoPanelOpen: boolean
  theme: ThemePreference
  /**
   * Unread count captured when the open chat was opened, so the
   * "Unread messages" divider stays put after the badge is cleared.
   */
  unreadMarker: { conversationId: ConversationId; count: number } | null
}

export interface UiStoreActions {
  setActiveConversation: (id: ConversationId | null) => void
  setFilter: (filter: ConversationFilter) => void
  setSearch: (search: string) => void
  /** Starting a reply cancels any edit, and vice versa. */
  setReplyingTo: (id: MessageId | null) => void
  setEditing: (id: MessageId | null) => void
  setInfoPanelOpen: (open: boolean) => void
  setTheme: (theme: ThemePreference) => void
  setUnreadMarker: (marker: UiState['unreadMarker']) => void
}

export type UiStore = UiState & UiStoreActions

export const initialUiState: UiState = {
  activeConversationId: null,
  filter: 'all',
  search: '',
  replyingToId: null,
  editingId: null,
  isInfoPanelOpen: false,
  theme: 'system',
  unreadMarker: null,
}

export const useUiStore = create<UiStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialUiState,
        setActiveConversation: (activeConversationId) =>
          set({ activeConversationId, replyingToId: null, editingId: null, unreadMarker: null }),
        setFilter: (filter) => set({ filter }),
        setSearch: (search) => set({ search }),
        setReplyingTo: (replyingToId) => set({ replyingToId, editingId: null }),
        setEditing: (editingId) => set({ editingId, replyingToId: null }),
        setInfoPanelOpen: (isInfoPanelOpen) => set({ isInfoPanelOpen }),
        setTheme: (theme) => set({ theme }),
        setUnreadMarker: (unreadMarker) => set({ unreadMarker }),
      }),
      {
        name: 'quantum-chat-ui',
        version: 1,
        storage: createJSONStorage(() => localStorage),
        // Only preferences survive a reload; the session state starts fresh.
        partialize: (s) => ({ theme: s.theme, filter: s.filter }),
      },
    ),
    { name: 'ui-store' },
  ),
)
