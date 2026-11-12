import { mockApi } from '@/services/mock/mock-api'
import { handleError } from '@/shared/lib/handle-error'
import type { ConversationId } from '@/types/common.types'
import type { Conversation } from '@/types/conversation.types'
import type { Message } from '@/types/message.types'

export interface Inbox {
  conversations: Conversation[]
  lastMessages: Message[]
}

export const conversationServices = {
  getInbox: async (): Promise<Inbox> => {
    try {
      const inbox = await mockApi.getInbox()
      if (!Array.isArray(inbox.conversations)) throw new Error('Invalid inbox response')
      return inbox
    } catch (error) {
      throw new Error(handleError(error, 'Could not load conversations'))
    }
  },

  markRead: async (id: ConversationId): Promise<Conversation> => {
    try {
      return await mockApi.markConversationRead(id)
    } catch (error) {
      throw new Error(handleError(error, 'Could not mark the chat as read'))
    }
  },
}
