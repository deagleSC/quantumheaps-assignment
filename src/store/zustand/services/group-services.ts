import { mockApi } from '@/services/mock/mock-api'
import { handleError } from '@/shared/lib/handle-error'
import type { ConversationId, UserId } from '@/types/common.types'
import type { GroupConversation } from '@/types/conversation.types'
import type { Message } from '@/types/message.types'

export interface MembershipChange {
  conversation: GroupConversation
  systemMessage: Message
}

export const groupServices = {
  addMembers: async (id: ConversationId, userIds: UserId[]): Promise<MembershipChange> => {
    try {
      return await mockApi.addMembers(id, userIds)
    } catch (error) {
      throw new Error(handleError(error, 'Could not add members'))
    }
  },

  removeMember: async (id: ConversationId, userId: UserId): Promise<MembershipChange> => {
    try {
      return await mockApi.removeMember(id, userId)
    } catch (error) {
      throw new Error(handleError(error, 'Could not remove the member'))
    }
  },
}
