import type { ConversationId, ISODateString, MessageId, UserId } from './common.types'

interface BaseConversation {
  id: ConversationId
  unreadCount: number
  lastMessageId?: MessageId
  updatedAt: ISODateString
}

export interface DirectConversation extends BaseConversation {
  type: 'direct'
  participantId: UserId
}

export interface GroupConversation extends BaseConversation {
  type: 'group'
  name: string
  avatarUrl?: string
  description?: string
  memberIds: UserId[]
  adminIds: UserId[]
  createdAt: ISODateString
}

/** Discriminated on `type`, so TypeScript narrows direct vs. group. */
export type Conversation = DirectConversation | GroupConversation

export type ConversationFilter = 'all' | 'unread' | 'groups'

/** Type guard for group conversations. */
export const isGroup = (c: Conversation): c is GroupConversation => c.type === 'group'
