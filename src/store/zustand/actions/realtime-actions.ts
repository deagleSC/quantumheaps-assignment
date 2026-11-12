import { isStatusUpgrade } from '@/shared/lib/message-status'
import { realtimeServices } from '../services/realtime-services'
import { useConversationStore } from '../stores/conversation-store'
import { useMessageStore } from '../stores/message-store'
import { useOutboxStore } from '../stores/outbox-store'
import { useTypingStore } from '../stores/typing-store'
import { useUiStore } from '../stores/ui-store'
import { useUserStore } from '../stores/user-store'
import { conversationActions } from './conversation-actions'

const isViewing = (conversationId: string) =>
  useUiStore.getState().activeConversationId === conversationId &&
  (typeof document === 'undefined' || document.visibilityState === 'visible')

export const realtimeActions = {
  /** 'memory' (simulator) or 'websocket'. */
  transportKind: () => realtimeServices.kind(),

  /** Subscribes every realtime event to the stores. Returns a disconnect function. */
  connect: (): (() => void) =>
    realtimeServices.connect({
      'message:new': ({ message }) => {
        useTypingStore.getState().stopTyping(message.conversationId, message.senderId)
        const messages = useMessageStore.getState()
        const conversations = useConversationStore.getState()
        // Our own message, accepted by the server (e.g. sent from another tab, or
        // this tab's queued copy flushed elsewhere): swap out the local copy.
        if (message.clientId && messages.byId[message.clientId]) {
          messages.replaceMessage(message.clientId, message)
          useOutboxStore.getState().dequeue(message.clientId)
        } else {
          messages.upsertMessage(message)
        }
        conversations.touchConversation(message.conversationId, message.id, message.createdAt)
        const isOwn = message.senderId === useUserStore.getState().currentUserId
        if (isOwn || message.kind === 'system') return
        if (isViewing(message.conversationId)) {
          void conversationActions.syncRead(message.conversationId)
        } else {
          conversations.incrementUnread(message.conversationId)
        }
      },
      // Edited, deleted, reacted to or status-changed in another tab.
      'message:updated': ({ message }) => {
        useMessageStore.getState().upsertMessage(message)
      },
      // Read, membership or latest message changed in another tab.
      'conversation:updated': ({ conversation }) => {
        const viewing = isViewing(conversation.id)
        useConversationStore.getState().upsertConversation({
          ...conversation,
          unreadCount: viewing ? 0 : conversation.unreadCount,
        })
        if (viewing && conversation.unreadCount > 0)
          void conversationActions.syncRead(conversation.id)
      },
      'message:status': ({ messageId, status }) => {
        const messages = useMessageStore.getState()
        const current = messages.byId[messageId]
        if (current && isStatusUpgrade(current.status, status)) {
          messages.patchMessage(messageId, { status })
        }
      },
      'typing:start': ({ conversationId, userId }) =>
        useTypingStore.getState().startTyping(conversationId, userId),
      'typing:stop': ({ conversationId, userId }) =>
        useTypingStore.getState().stopTyping(conversationId, userId),
      'presence:change': ({ userId, isOnline, lastSeen }) =>
        useUserStore.getState().patchUser(userId, { isOnline, lastSeen }),
    }),
}
