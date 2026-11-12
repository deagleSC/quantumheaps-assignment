import { defaultMockApiConfig, type MockApiConfig } from '@/shared/lib/configs/mock-api'
import type { ConversationId, MessageId, UserId } from '@/types/common.types'
import type { Conversation, GroupConversation } from '@/types/conversation.types'
import type { Message, MessagePage, SendMessageInput } from '@/types/message.types'
import type { User } from '@/types/user.types'
import { MockDb } from './mock-db'

export class MockApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MockApiError'
  }
}

let config: MockApiConfig = { ...defaultMockApiConfig }
let db = new MockDb()
let random: () => number = Math.random

/** Override latency/failure settings (tests use zero latency and no failures). */
export function configureMockApi(overrides: Partial<MockApiConfig> & { random?: () => number }) {
  const { random: rng, ...rest } = overrides
  config = { ...config, ...rest }
  if (rng) random = rng
}

/** Fresh seed data, e.g. between tests. */
export function resetMockApi(options?: ConstructorParameters<typeof MockDb>[0]) {
  db = new MockDb(options)
  config = { ...defaultMockApiConfig }
  random = Math.random
}

/** Shared with the realtime simulator, which writes incoming messages directly. */
export const getMockDb = () => db

type Kind = 'read' | 'write'

/**
 * Wraps a DB call with network-like latency and random failures.
 * The DB runs after the delay, so a failed request never changes data.
 */
function request<T>(kind: Kind, label: string, run: (db: MockDb) => T): Promise<T> {
  const { min, max } = config.latency
  const delay = min + random() * Math.max(0, max - min)
  const failureRate = kind === 'read' ? config.readFailureRate : config.writeFailureRate
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      if (random() < failureRate) {
        reject(new MockApiError(`Network error while trying to ${label}`))
        return
      }
      try {
        resolve(run(db))
      } catch (error) {
        reject(error)
      }
    }, delay)
  })
}

/**
 * Promise-based fake REST API. Only the services layer
 * (`store/zustand/services`) calls this.
 */
export const mockApi = {
  getCurrentUserId: (): Promise<UserId> =>
    request('read', 'load your profile', (d) => d.currentUserId),
  getUsers: (): Promise<User[]> => request('read', 'load contacts', (d) => d.getUsers()),
  getConversations: (): Promise<Conversation[]> =>
    request('read', 'load conversations', (d) => d.getConversations()),
  getMessages: (
    conversationId: ConversationId,
    opts?: { before?: MessageId; limit?: number },
  ): Promise<MessagePage> =>
    request('read', 'load messages', (d) => d.getMessages(conversationId, opts)),

  sendMessage: (input: SendMessageInput): Promise<Message> =>
    request('write', 'send the message', (d) => d.insertOwnMessage(input)),
  editMessage: (id: MessageId, content: string): Promise<Message> =>
    request('write', 'edit the message', (d) => d.editMessage(id, content)),
  deleteMessage: (id: MessageId): Promise<Message> =>
    request('write', 'delete the message', (d) => d.deleteMessage(id)),
  toggleReaction: (id: MessageId, emoji: string): Promise<Message> =>
    request('write', 'react to the message', (d) => d.toggleReaction(id, emoji)),
  markConversationRead: (id: ConversationId): Promise<Conversation> =>
    request('write', 'mark the chat as read', (d) => d.markConversationRead(id)),

  addMembers: (
    id: ConversationId,
    userIds: UserId[],
  ): Promise<{ conversation: GroupConversation; systemMessage: Message }> =>
    request('write', 'add members', (d) => d.addMembers(id, userIds)),
  removeMember: (
    id: ConversationId,
    userId: UserId,
  ): Promise<{ conversation: GroupConversation; systemMessage: Message }> =>
    request('write', 'remove the member', (d) => d.removeMember(id, userId)),
}

export type MockApi = typeof mockApi
