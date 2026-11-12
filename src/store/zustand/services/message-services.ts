import { mockApi } from '@/services/mock/mock-api'
import { handleError } from '@/shared/lib/handle-error'
import type { ConversationId, MessageId } from '@/types/common.types'
import type { Message, MessagePage, SendMessageInput } from '@/types/message.types'

export const MESSAGE_PAGE_SIZE = 30

export const messageServices = {
  getPage: async (
    conversationId: ConversationId,
    before?: MessageId,
    limit = MESSAGE_PAGE_SIZE,
  ): Promise<MessagePage> => {
    try {
      return await mockApi.getMessages(conversationId, { before, limit })
    } catch (error) {
      throw new Error(handleError(error, 'Could not load messages'))
    }
  },

  send: async (input: SendMessageInput): Promise<Message> => {
    try {
      return await mockApi.sendMessage(input)
    } catch (error) {
      throw new Error(handleError(error, 'Message failed to send'))
    }
  },

  edit: async (id: MessageId, content: string): Promise<Message> => {
    try {
      return await mockApi.editMessage(id, content)
    } catch (error) {
      throw new Error(handleError(error, 'Could not edit the message'))
    }
  },

  remove: async (id: MessageId): Promise<Message> => {
    try {
      return await mockApi.deleteMessage(id)
    } catch (error) {
      throw new Error(handleError(error, 'Could not delete the message'))
    }
  },

  toggleReaction: async (id: MessageId, emoji: string): Promise<Message> => {
    try {
      return await mockApi.toggleReaction(id, emoji)
    } catch (error) {
      throw new Error(handleError(error, 'Could not add the reaction'))
    }
  },
}
