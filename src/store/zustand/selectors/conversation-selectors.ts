import type { ConversationId, MessageId, UserId } from '@/types/common.types'
import type { Conversation, ConversationFilter } from '@/types/conversation.types'
import type { Message } from '@/types/message.types'
import type { User } from '@/types/user.types'

export interface ConversationDisplay {
  title: string
  avatarUrl?: string
  /** `undefined` for groups (no single presence). */
  isOnline?: boolean
  /** The other person in a direct chat. */
  peer?: User
}

/** Title, avatar and presence for a conversation row or header. */
export function getConversationDisplay(
  conversation: Conversation,
  usersById: Record<UserId, User>,
): ConversationDisplay {
  if (conversation.type === 'group') {
    return { title: conversation.name, avatarUrl: conversation.avatarUrl }
  }
  const peer = usersById[conversation.participantId]
  return {
    title: peer?.name ?? 'Unknown user',
    avatarUrl: peer?.avatarUrl,
    isOnline: peer?.isOnline ?? false,
    peer,
  }
}

/** Sidebar preview line: "You: …", "Priya: …" (groups), deleted and system text. */
export function getMessagePreview(
  message: Message | undefined,
  conversation: Conversation,
  usersById: Record<UserId, User>,
  currentUserId: UserId | null,
): string {
  if (!message) return 'No messages yet'
  if (message.kind === 'system') return message.content
  const body = message.isDeleted
    ? 'This message was deleted'
    : message.content || (message.attachment ? `📎 ${message.attachment.name}` : '')
  if (message.senderId === currentUserId) return `You: ${body}`
  if (conversation.type === 'group') {
    const first = usersById[message.senderId]?.name.split(' ')[0] ?? 'Someone'
    return `${first}: ${body}`
  }
  return body
}

export interface FilterConversationsInput {
  order: ConversationId[]
  byId: Record<ConversationId, Conversation>
  usersById: Record<UserId, User>
  messagesById: Record<MessageId, Message>
  filter: ConversationFilter
  search: string
}

/** Applies the All/Unread/Groups tab and a case-insensitive name/preview search. */
export function filterConversations({
  order,
  byId,
  usersById,
  messagesById,
  filter,
  search,
}: FilterConversationsInput): ConversationId[] {
  const query = search.trim().toLowerCase()
  return order.filter((id) => {
    const c = byId[id]
    if (!c) return false
    if (filter === 'unread' && c.unreadCount === 0) return false
    if (filter === 'groups' && c.type !== 'group') return false
    if (!query) return true
    const { title } = getConversationDisplay(c, usersById)
    const last = c.lastMessageId ? messagesById[c.lastMessageId] : undefined
    return (
      title.toLowerCase().includes(query) ||
      (!!last && !last.isDeleted && last.content.toLowerCase().includes(query))
    )
  })
}

export const getTotalUnread = (byId: Record<ConversationId, Conversation>) =>
  Object.values(byId).reduce((sum, c) => sum + c.unreadCount, 0)

/** "Priya is typing…", "Priya and Daniel are typing…", "3 people are typing…". */
export function getTypingLabel(userIds: UserId[], usersById: Record<UserId, User>): string | null {
  if (userIds.length === 0) return null
  const names = userIds.map((id) => usersById[id]?.name.split(' ')[0] ?? 'Someone')
  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  return `${names.length} people are typing…`
}
