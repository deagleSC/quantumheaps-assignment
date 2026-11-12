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
}

export const useUiStore = create<UiStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialUiState,
        setActiveConversation: (activeConversationId) =>
          set({ activeConversationId, replyingToId: null, editingId: null }),
        setFilter: (filter) => set({ filter }),
        setSearch: (search) => set({ search }),
        setReplyingTo: (replyingToId) => set({ replyingToId, editingId: null }),
        setEditing: (editingId) => set({ editingId, replyingToId: null }),
        setInfoPanelOpen: (isInfoPanelOpen) => set({ isInfoPanelOpen }),
        setTheme: (theme) => set({ theme }),
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
