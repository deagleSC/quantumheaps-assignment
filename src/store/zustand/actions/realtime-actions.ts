import { isStatusUpgrade } from '@/shared/lib/message-status'
import { realtimeServices } from '../services/realtime-services'
import { useConversationStore } from '../stores/conversation-store'
import { useMessageStore } from '../stores/message-store'
import { useTypingStore } from '../stores/typing-store'
import { useUiStore } from '../stores/ui-store'
import { useUserStore } from '../stores/user-store'
import { conversationActions } from './conversation-actions'

const isViewing = (conversationId: string) =>
  useUiStore.getState().activeConversationId === conversationId &&
  (typeof document === 'undefined' || document.visibilityState === 'visible')

export const realtimeActions = {
  /** Subscribes every realtime event to the stores. Returns a disconnect function. */
  connect: (): (() => void) =>
    realtimeServices.connect({
      'message:new': ({ message }) => {
        useTypingStore.getState().stopTyping(message.conversationId, message.senderId)
        useMessageStore.getState().upsertMessage(message)
        const conversations = useConversationStore.getState()
        conversations.touchConversation(message.conversationId, message.id, message.createdAt)
        if (isViewing(message.conversationId)) {
          void conversationActions.syncRead(message.conversationId)
        } else {
          conversations.incrementUnread(message.conversationId)
        }
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
