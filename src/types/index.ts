/**
 * Core domain models for the chat app.
 * Branded string aliases keep IDs readable at call sites; the discriminated
 * `Conversation` union lets TypeScript narrow on `type`.
 */

export type UserId = string
export type ConversationId = string
export type MessageId = string
/** ISO-8601 timestamp string. */
export type ISODateString = string

export interface User {
  id: UserId
  name: string
  avatarUrl: string
  isOnline: boolean
  lastSeen?: ISODateString
  /** Short status line shown in the profile panel. */
  about?: string
}

export const MESSAGE_STATUSES = ['sending', 'sent', 'delivered', 'read', 'failed'] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

export interface Reaction {
  emoji: string
  userIds: UserId[]
}

export interface Attachment {
  name: string
  /** MIME type, e.g. `image/png`. */
  type: string
  size: number
  /** Object URL or data URL used for the preview. */
  previewUrl: string
}

/** `system` messages record events such as "Alice added Bob". */
export type MessageKind = 'text' | 'system'

export interface Message {
  id: MessageId
  conversationId: ConversationId
  senderId: UserId
  kind: MessageKind
  content: string
  createdAt: ISODateString
  editedAt?: ISODateString
  isDeleted?: boolean
  replyToId?: MessageId
  status: MessageStatus
  reactions: Reaction[]
  attachment?: Attachment
  /** Temporary client ID for optimistic sends, kept until the server confirms. */
  clientId?: string
}

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

export type Conversation = DirectConversation | GroupConversation

export type ConversationFilter = 'all' | 'unread' | 'groups'

export type ThemePreference = 'light' | 'dark' | 'system'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

/** Type guard for group conversations. */
export const isGroup = (c: Conversation): c is GroupConversation => c.type === 'group'
