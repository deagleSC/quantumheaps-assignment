import { handleError } from '@/shared/lib/handle-error'
import type { ConversationId } from '@/types/common.types'
import { conversationServices } from '../services/conversation-services'
import { userServices } from '../services/user-services'
import { useConversationStore } from '../stores/conversation-store'
import { useMessageStore } from '../stores/message-store'
import { useUiStore } from '../stores/ui-store'
import { useUserStore } from '../stores/user-store'
import { messageActions } from './message-actions'

export const conversationActions = {
  /** Loads the current user, contacts and conversations (with last-message previews). */
  loadInbox: async (): Promise<void> => {
    const conversations = useConversationStore.getState()
    const users = useUserStore.getState()
    // StrictMode mounts effects twice in development; one request is enough.
    if (conversations.status === 'loading') return
    conversations.setStatus('loading')
    users.setStatus('loading')
    try {
      const [currentUserId, allUsers, inbox] = await Promise.all([
        userServices.getCurrentUserId(),
        userServices.getAll(),
        conversationServices.getInbox(),
      ])
      users.setCurrentUserId(currentUserId)
      users.setUsers(allUsers)
      users.setStatus('success')
      useMessageStore.getState().cacheMessages(inbox.lastMessages)
      conversations.setConversations(inbox.conversations)
      conversations.setStatus('success')
      await messageActions.restoreOutbox()
    } catch (error) {
      const message = handleError(error)
      users.setStatus('error', message)
      conversations.setStatus('error', message)
    }
  },

  /** Opens a conversation: loads its history once and marks it read. */
  open: async (id: ConversationId): Promise<void> => {
    const ui = useUiStore.getState()
    if (ui.activeConversationId === id) return
    ui.setActiveConversation(id)
    const unread = useConversationStore.getState().byId[id]?.unreadCount ?? 0
    if (unread > 0) ui.setUnreadMarker({ conversationId: id, count: unread })
    const timeline = useMessageStore.getState().byConversation[id]
    const needsHistory = !timeline || timeline.status === 'error' || timeline.status === 'idle'
    await Promise.all([
      needsHistory ? messageActions.loadHistory(id) : Promise.resolve(),
      conversationActions.markRead(id),
    ])
  },

  close: (): void => {
    useUiStore.getState().setActiveConversation(null)
  },

  /**
   * Clears the unread badge immediately. If the server call fails we keep the
   * local "read" state: the user has seen the messages either way.
   */
  markRead: async (id: ConversationId): Promise<void> => {
    const conversation = useConversationStore.getState().byId[id]
    if (!conversation || conversation.unreadCount === 0) return
    useConversationStore.getState().setUnreadCount(id, 0)
    await conversationActions.syncRead(id)
  },

  /** Tells the server the conversation is read, ignoring failures. */
  syncRead: async (id: ConversationId): Promise<void> => {
    try {
      await conversationServices.markRead(id)
    } catch {
      // Non-critical: the next markRead call will sync again.
    }
  },
}
