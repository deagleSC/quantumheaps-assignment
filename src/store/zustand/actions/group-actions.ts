import type { ConversationId, UserId } from '@/types/common.types'
import type { MembershipChange } from '../services/group-services'
import { groupServices } from '../services/group-services'
import { useConversationStore } from '../stores/conversation-store'
import { useMessageStore } from '../stores/message-store'

/** Applies a membership change, keeping the client's own unread count. */
function applyChange({ conversation, systemMessage }: MembershipChange) {
  const conversations = useConversationStore.getState()
  const unreadCount = conversations.byId[conversation.id]?.unreadCount ?? 0
  conversations.upsertConversation({ ...conversation, unreadCount })
  useMessageStore.getState().upsertMessage(systemMessage)
  conversations.touchConversation(conversation.id, systemMessage.id, systemMessage.createdAt)
}

/**
 * Membership changes are not optimistic: the dialog waits for the result.
 * Errors are rethrown so the form can show them.
 */
export const groupActions = {
  addMembers: async (conversationId: ConversationId, userIds: UserId[]): Promise<void> => {
    applyChange(await groupServices.addMembers(conversationId, userIds))
  },

  removeMember: async (conversationId: ConversationId, userId: UserId): Promise<void> => {
    applyChange(await groupServices.removeMember(conversationId, userId))
  },
}
