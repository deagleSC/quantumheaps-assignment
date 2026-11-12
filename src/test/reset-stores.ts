import {
  initialConnectionState,
  initialConversationState,
  initialMessageState,
  initialOutboxState,
  initialTypingState,
  initialUiState,
  initialUserState,
  useConnectionStore,
  useConversationStore,
  useMessageStore,
  useOutboxStore,
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
  useConnectionStore.setState({ ...initialConnectionState, isBrowserOnline: true })
  useOutboxStore.setState(initialOutboxState)
}
