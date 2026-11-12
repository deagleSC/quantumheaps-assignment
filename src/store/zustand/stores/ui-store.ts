import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import type { ConversationId, MessageId, ThemePreference } from '@/types/common.types'
import type { ConversationFilter } from '@/types/conversation.types'

export interface MessageSearchState {
  query: string
  /** The match currently focused (highlighted and scrolled to). */
  activeMatchId: MessageId | null
}

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
  /** In-chat search; `null` when the search bar is closed. */
  messageSearch: MessageSearchState | null
  isShortcutsOpen: boolean
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
  openMessageSearch: () => void
  closeMessageSearch: () => void
  setMessageSearchQuery: (query: string) => void
  setActiveSearchMatch: (id: MessageId | null) => void
  setShortcutsOpen: (open: boolean) => void
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
  messageSearch: null,
  isShortcutsOpen: false,
}

export const useUiStore = create<UiStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialUiState,
        // Switching chats resets everything scoped to the previous chat.
        setActiveConversation: (activeConversationId) =>
          set({
            activeConversationId,
            replyingToId: null,
            editingId: null,
            unreadMarker: null,
            messageSearch: null,
          }),
        setFilter: (filter) => set({ filter }),
        setSearch: (search) => set({ search }),
        setReplyingTo: (replyingToId) => set({ replyingToId, editingId: null }),
        setEditing: (editingId) => set({ editingId, replyingToId: null }),
        setInfoPanelOpen: (isInfoPanelOpen) => set({ isInfoPanelOpen }),
        setTheme: (theme) => set({ theme }),
        setUnreadMarker: (unreadMarker) => set({ unreadMarker }),
        openMessageSearch: () =>
          set((s) => ({ messageSearch: s.messageSearch ?? { query: '', activeMatchId: null } })),
        closeMessageSearch: () => set({ messageSearch: null }),
        setMessageSearchQuery: (query) =>
          set((s) => (s.messageSearch ? { messageSearch: { query, activeMatchId: null } } : s)),
        setActiveSearchMatch: (activeMatchId) =>
          set((s) =>
            s.messageSearch ? { messageSearch: { ...s.messageSearch, activeMatchId } } : s,
          ),
        setShortcutsOpen: (isShortcutsOpen) => set({ isShortcutsOpen }),
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
