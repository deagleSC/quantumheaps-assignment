import type { ConversationId, ISODateString, MessageId, UserId } from './common.types'

/** `queued`: written while offline, waiting in the outbox to be sent. */
export const MESSAGE_STATUSES = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
] as const
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

/** Payload for sending a message. `clientId` ties the server copy to the optimistic one. */
export interface SendMessageInput {
  conversationId: ConversationId
  content: string
  clientId: string
  replyToId?: MessageId
  attachment?: Attachment
}

/** One page of history, newest page first when paginating backwards. */
export interface MessagePage {
  messages: Message[]
  /** True when older messages exist before this page. */
  hasMore: boolean
}
