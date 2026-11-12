import { nanoid } from 'nanoid'
import { toggleReaction as toggleReactionList } from '@/shared/lib/reactions'
import type { ConversationId, MessageId, UserId } from '@/types/common.types'
import type { Conversation, GroupConversation } from '@/types/conversation.types'
import type { Message, SendMessageInput } from '@/types/message.types'
import type { User } from '@/types/user.types'
import { seedConversations } from './data/conversations'
import { generateMessages } from './data/message-generator'
import { createRng } from './data/random'
import { CURRENT_USER_ID, initiallyOnline, seedUsers } from './data/users'

export class MockDbError extends Error {
  readonly code: 'not_found' | 'forbidden' | 'invalid'
  constructor(code: MockDbError['code'], message: string) {
    super(message)
    this.name = 'MockDbError'
    this.code = code
  }
}

export interface CreateMockDbOptions {
  /** Timestamp seed history ends at. Defaults to now. */
  now?: number
  seed?: number
  /** Restore previously persisted data instead of generating seed data. */
  snapshot?: MockDbSnapshot
}

/** Everything the fake backend stores, in a structured-clone friendly shape. */
export interface MockDbSnapshot {
  currentUserId: UserId
  users: User[]
  conversations: Conversation[]
  messages: Record<ConversationId, Message[]>
}

/** Storage keys a write touched; lets persistence rewrite only what changed. */
export type ChangeKey = 'users' | 'conversations' | `messages:${ConversationId}`
export const messagesKey = (id: ConversationId): ChangeKey => `messages:${id}`

/**
 * The fake backend's storage. Synchronous and free of latency or failures,
 * so the API layer and the realtime simulator can share it.
 * Every read returns copies, so callers can never mutate stored data.
 */
export class MockDb {
  readonly currentUserId: UserId = CURRENT_USER_ID
  private users = new Map<UserId, User>()
  private conversations = new Map<ConversationId, Conversation>()
  /** Messages per conversation, ascending by `createdAt`. */
  private messagesByConversation = new Map<ConversationId, Message[]>()
  private messagesById = new Map<MessageId, Message>()
  private listeners = new Set<(keys: ChangeKey[]) => void>()

  constructor({ now = Date.now(), seed = 42, snapshot }: CreateMockDbOptions = {}) {
    if (snapshot) this.hydrate(snapshot)
    else this.seed(now, seed)
  }

  private hydrate(snapshot: MockDbSnapshot) {
    for (const u of snapshot.users) this.users.set(u.id, u)
    for (const c of snapshot.conversations) {
      this.conversations.set(c.id, c)
      const messages = snapshot.messages[c.id] ?? []
      this.messagesByConversation.set(c.id, messages)
      for (const m of messages) this.messagesById.set(m.id, m)
    }
  }

  private seed(now: number, seed: number) {
    const rng = createRng(seed)

    for (const u of seedUsers) {
      const isOnline = u.id === CURRENT_USER_ID || initiallyOnline.has(u.id)
      this.users.set(u.id, {
        ...u,
        isOnline,
        lastSeen: isOnline ? undefined : new Date(now - (1 + rng() * 300) * 60_000).toISOString(),
      })
    }

    for (const seedConv of seedConversations) {
      const participantIds =
        seedConv.type === 'direct'
          ? [CURRENT_USER_ID, seedConv.participantId]
          : [CURRENT_USER_ID, ...seedConv.memberIds]
      const messages = generateMessages({
        conversationId: seedConv.id,
        count: seedConv.messageCount,
        currentUserId: CURRENT_USER_ID,
        participantIds,
        unread: seedConv.unread,
        days: seedConv.days,
        now: now - (seedConv.endDaysAgo ?? 0) * 24 * 60 * 60_000,
        rng,
      })
      const last = messages[messages.length - 1]
      const base = {
        id: seedConv.id,
        unreadCount: Math.min(seedConv.unread, messages.length),
        lastMessageId: last?.id,
        updatedAt: last?.createdAt ?? new Date(now - 2 * 24 * 60 * 60_000).toISOString(),
      }
      const conversation: Conversation =
        seedConv.type === 'direct'
          ? { ...base, type: 'direct', participantId: seedConv.participantId }
          : {
              ...base,
              type: 'group',
              name: seedConv.name,
              description: seedConv.description,
              memberIds: participantIds,
              adminIds: seedConv.adminIds,
              createdAt: messages[0]?.createdAt ?? base.updatedAt,
            }
      this.conversations.set(conversation.id, conversation)
      this.messagesByConversation.set(conversation.id, messages)
      for (const m of messages) this.messagesById.set(m.id, m)
    }
  }

  // ---------- change tracking & snapshots ----------

  /** Subscribe to writes. Returns an unsubscribe function. */
  onChange(listener: (keys: ChangeKey[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private changed(...keys: ChangeKey[]) {
    for (const listener of this.listeners) listener(keys)
  }

  /** Every storage key the database currently has. */
  allKeys(): ChangeKey[] {
    return ['users', 'conversations', ...[...this.conversations.keys()].map(messagesKey)]
  }

  /** Full message list of a conversation (for persistence). */
  getAllMessages(conversationId: ConversationId): Message[] {
    return this.requireMessages(conversationId).map(clone)
  }

  toSnapshot(): MockDbSnapshot {
    return {
      currentUserId: this.currentUserId,
      users: this.getUsers(),
      conversations: this.getConversations(),
      messages: Object.fromEntries(
        [...this.conversations.keys()].map((id) => [id, this.getAllMessages(id)]),
      ),
    }
  }

  // ---------- reads ----------

  getUsers(): User[] {
    return [...this.users.values()].map(clone)
  }

  getUser(id: UserId): User {
    return clone(this.requireUser(id))
  }

  getConversations(): Conversation[] {
    return [...this.conversations.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(clone)
  }

  /** Last message of every conversation (for sidebar previews). */
  getLastMessages(): Message[] {
    return [...this.conversations.values()].flatMap((c) =>
      c.lastMessageId ? [clone(this.requireMessage(c.lastMessageId))] : [],
    )
  }

  getConversation(id: ConversationId): Conversation {
    return clone(this.requireConversation(id))
  }

  /** Newest `limit` messages strictly older than `before` (or the newest overall). */
  getMessages(conversationId: ConversationId, opts: { before?: MessageId; limit?: number } = {}) {
    const list = this.requireMessages(conversationId)
    const limit = opts.limit ?? 30
    let end = list.length
    if (opts.before) {
      end = list.findIndex((m) => m.id === opts.before)
      if (end === -1) throw new MockDbError('not_found', `Message ${opts.before} not found`)
    }
    const start = Math.max(0, end - limit)
    return { messages: list.slice(start, end).map(clone), hasMore: start > 0 }
  }

  getMessage(id: MessageId): Message {
    return clone(this.requireMessage(id))
  }

  /** Every member except the current user, for picking auto-responders. */
  getOtherParticipants(conversationId: ConversationId): UserId[] {
    const c = this.requireConversation(conversationId)
    const ids = c.type === 'direct' ? [c.participantId] : c.memberIds
    return ids.filter((id) => id !== this.currentUserId)
  }

  // ---------- writes ----------

  /** Inserts a message sent by the current user, with status `sent`. */
  insertOwnMessage(input: SendMessageInput, now = Date.now()): Message {
    const content = input.content.trim()
    if (!content && !input.attachment) throw new MockDbError('invalid', 'Message is empty')
    if (input.replyToId) this.requireMessage(input.replyToId)
    return this.insert({
      id: `m-${nanoid(10)}`,
      conversationId: input.conversationId,
      senderId: this.currentUserId,
      kind: 'text',
      content,
      createdAt: new Date(now).toISOString(),
      status: 'sent',
      reactions: [],
      replyToId: input.replyToId,
      attachment: input.attachment,
      clientId: input.clientId,
    })
  }

  /** Inserts a message from someone else; bumps the unread count. */
  insertIncomingMessage(
    conversationId: ConversationId,
    senderId: UserId,
    content: string,
    now = Date.now(),
  ): Message {
    const message = this.insert({
      id: `m-${nanoid(10)}`,
      conversationId,
      senderId,
      kind: 'text',
      content,
      createdAt: new Date(now).toISOString(),
      status: 'delivered',
      reactions: [],
    })
    this.requireConversation(conversationId).unreadCount += 1
    this.changed('conversations')
    return message
  }

  editMessage(id: MessageId, content: string, now = Date.now()): Message {
    const m = this.requireOwnMessage(id)
    if (m.isDeleted) throw new MockDbError('invalid', 'Cannot edit a deleted message')
    const trimmed = content.trim()
    if (!trimmed) throw new MockDbError('invalid', 'Message is empty')
    m.content = trimmed
    m.editedAt = new Date(now).toISOString()
    this.changed(messagesKey(m.conversationId))
    return clone(m)
  }

  /** Soft delete: the bubble stays as "This message was deleted". */
  deleteMessage(id: MessageId): Message {
    const m = this.requireOwnMessage(id)
    m.isDeleted = true
    m.content = ''
    m.reactions = []
    m.attachment = undefined
    this.changed(messagesKey(m.conversationId))
    return clone(m)
  }

  /** Adds `userId`'s reaction with `emoji`, or removes it if already there. */
  toggleReaction(id: MessageId, emoji: string, userId: UserId = this.currentUserId): Message {
    const m = this.requireMessage(id)
    if (m.isDeleted) throw new MockDbError('invalid', 'Cannot react to a deleted message')
    m.reactions = toggleReactionList(m.reactions, emoji, userId)
    this.changed(messagesKey(m.conversationId))
    return clone(m)
  }

  setMessageStatus(id: MessageId, status: Message['status']): Message {
    const m = this.requireMessage(id)
    m.status = status
    this.changed(messagesKey(m.conversationId))
    return clone(m)
  }

  markConversationRead(id: ConversationId): Conversation {
    const c = this.requireConversation(id)
    c.unreadCount = 0
    this.changed('conversations')
    return clone(c)
  }

  setPresence(userId: UserId, isOnline: boolean, now = Date.now()): User {
    const u = this.requireUser(userId)
    u.isOnline = isOnline
    u.lastSeen = isOnline ? undefined : new Date(now).toISOString()
    this.changed('users')
    return clone(u)
  }

  addMembers(conversationId: ConversationId, userIds: UserId[], now = Date.now()) {
    const group = this.requireGroup(conversationId)
    const toAdd = userIds.filter((id) => !group.memberIds.includes(id))
    if (toAdd.length === 0) throw new MockDbError('invalid', 'No new members to add')
    toAdd.forEach((id) => this.requireUser(id))
    group.memberIds.push(...toAdd)
    this.changed('conversations')
    const names = toAdd.map((id) => this.requireUser(id).name).join(', ')
    const systemMessage = this.insertSystemMessage(group.id, `You added ${names}`, now)
    return { conversation: clone(group), systemMessage }
  }

  removeMember(conversationId: ConversationId, userId: UserId, now = Date.now()) {
    const group = this.requireGroup(conversationId)
    if (userId === this.currentUserId)
      throw new MockDbError('forbidden', 'Use "leave group" instead')
    if (!group.memberIds.includes(userId))
      throw new MockDbError('not_found', 'User is not a member')
    group.memberIds = group.memberIds.filter((id) => id !== userId)
    group.adminIds = group.adminIds.filter((id) => id !== userId)
    this.changed('conversations')
    const systemMessage = this.insertSystemMessage(
      group.id,
      `You removed ${this.requireUser(userId).name}`,
      now,
    )
    return { conversation: clone(group), systemMessage }
  }

  // ---------- internals ----------

  private insertSystemMessage(conversationId: ConversationId, content: string, now: number) {
    return this.insert({
      id: `m-${nanoid(10)}`,
      conversationId,
      senderId: this.currentUserId,
      kind: 'system',
      content,
      createdAt: new Date(now).toISOString(),
      status: 'read',
      reactions: [],
    })
  }

  private insert(message: Message): Message {
    const conversation = this.requireConversation(message.conversationId)
    const list = this.requireMessages(message.conversationId)
    list.push(message)
    this.messagesById.set(message.id, message)
    conversation.lastMessageId = message.id
    conversation.updatedAt = message.createdAt
    this.changed(messagesKey(message.conversationId), 'conversations')
    return clone(message)
  }

  private requireUser(id: UserId) {
    const u = this.users.get(id)
    if (!u) throw new MockDbError('not_found', `User ${id} not found`)
    return u
  }

  private requireConversation(id: ConversationId) {
    const c = this.conversations.get(id)
    if (!c) throw new MockDbError('not_found', `Conversation ${id} not found`)
    return c
  }

  private requireGroup(id: ConversationId): GroupConversation {
    const c = this.requireConversation(id)
    if (c.type !== 'group') throw new MockDbError('invalid', `Conversation ${id} is not a group`)
    return c
  }

  private requireMessages(id: ConversationId) {
    this.requireConversation(id)
    let list = this.messagesByConversation.get(id)
    if (!list) {
      list = []
      this.messagesByConversation.set(id, list)
    }
    return list
  }

  private requireMessage(id: MessageId) {
    const m = this.messagesById.get(id)
    if (!m) throw new MockDbError('not_found', `Message ${id} not found`)
    return m
  }

  private requireOwnMessage(id: MessageId) {
    const m = this.requireMessage(id)
    if (m.senderId !== this.currentUserId || m.kind !== 'text') {
      throw new MockDbError('forbidden', 'You can only change your own messages')
    }
    return m
  }
}

const clone = <T>(value: T): T => structuredClone(value)
