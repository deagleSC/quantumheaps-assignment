// Stores: state + plain setters
export { useUserStore, initialUserState } from './zustand/stores/user-store'
export { useConversationStore, initialConversationState } from './zustand/stores/conversation-store'
export { useMessageStore, initialMessageState } from './zustand/stores/message-store'
export { useTypingStore, initialTypingState } from './zustand/stores/typing-store'
export { useUiStore, initialUiState } from './zustand/stores/ui-store'
export {
  useConnectionStore,
  initialConnectionState,
  selectIsOnline,
} from './zustand/stores/connection-store'
export { useOutboxStore, initialOutboxState } from './zustand/stores/outbox-store'
export type { UserStore } from './zustand/stores/user-store'
export type { ConversationStore } from './zustand/stores/conversation-store'
export type { MessageStore, ConversationMessages } from './zustand/stores/message-store'
export type { TypingStore } from './zustand/stores/typing-store'
export type { UiStore } from './zustand/stores/ui-store'

// Actions: async logic, called by components
export { conversationActions } from './zustand/actions/conversation-actions'
export { messageActions, isTempId } from './zustand/actions/message-actions'
export type { NewMessage } from './zustand/actions/message-actions'
export { groupActions } from './zustand/actions/group-actions'
export { realtimeActions } from './zustand/actions/realtime-actions'
export { appActions } from './zustand/actions/app-actions'
export { connectionActions } from './zustand/actions/connection-actions'

// Selectors: pure derived data
export * from './zustand/selectors/conversation-selectors'
