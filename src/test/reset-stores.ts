import {
  initialConversationState,
  initialMessageState,
  initialTypingState,
  initialUiState,
  initialUserState,
  useConversationStore,
  useMessageStore,
  useTypingStore,
  useUiStore,
  useUserStore,
} from '@/store'

/** Restores every store's initial state, keeping its setters. */
export function resetStores() {
  useUserStore.setState(initialUserState)
  useConversationStore.setState(initialConversationState)
  useMessageStore.setState(initialMessageState)
  useTypingStore.setState(initialTypingState)
  useUiStore.setState(initialUiState)
}
