import type { Conversation, GroupConversation } from '@/types/conversation.types'
import type { Message } from '@/types/message.types'
import type { User } from '@/types/user.types'

export const user = (id: string, name: string, isOnline = true): User => ({
  id,
  name,
  avatarUrl: '',
  isOnline,
})

export const message = (id: string, overrides: Partial<Message> = {}): Message => ({
  id,
  conversationId: 'c1',
  senderId: 'me',
  kind: 'text',
  content: `msg ${id}`,
  createdAt: '2026-11-12T10:00:00.000Z',
  status: 'read',
  reactions: [],
  ...overrides,
})

export const direct = (id: string, participantId: string, overrides: Partial<Conversation> = {}) =>
  ({
    id,
    type: 'direct',
    participantId,
    unreadCount: 0,
    updatedAt: '2026-11-12T10:00:00.000Z',
    ...overrides,
  }) as Conversation

export const group = (
  id: string,
  overrides: Partial<GroupConversation> = {},
): GroupConversation => ({
  id,
  type: 'group',
  name: 'Team',
  memberIds: ['me', 'u1'],
  adminIds: ['me'],
  unreadCount: 0,
  updatedAt: '2026-11-12T10:00:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
  ...overrides,
})

export const at = (minute: number) => new Date(Date.UTC(2026, 10, 12, 10, minute)).toISOString()
