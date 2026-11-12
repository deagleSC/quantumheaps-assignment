import { defaultMockApiConfig, type MockApiConfig } from '@/shared/lib/configs/mock-api'
import type { ConversationId, MessageId, UserId } from '@/types/common.types'
import type { Conversation, GroupConversation } from '@/types/conversation.types'
import type { Message, MessagePage, SendMessageInput } from '@/types/message.types'
import type { User } from '@/types/user.types'
import { OFFLINE_MESSAGE } from '@/shared/lib/network'
import type { ServerFrame } from '@/services/realtime/protocol'
import { type DbOp, MockDb } from './mock-db'
import { createTabSync, type TabSync } from './tab-sync'
import { TypedEmitter } from './typed-emitter'
import {
  clearPersisted,
  createPersister,
  isPersistenceAvailable,
  loadSnapshot,
  type Persister,
} from './persistence'

export class MockApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MockApiError'
  }
}

let config: MockApiConfig = { ...defaultMockApiConfig }
// Created lazily: seeding 10k+ messages is skipped when persisted data exists.
let db: MockDb | null = null
let random: () => number = Math.random
let ready: Promise<void> = Promise.resolve()
let persister: Persister | null = null
let offline = false
let sync: TabSync | null = null

// ---------- multiple tabs ----------

/**
 * The "leader" tab holds the single-writer lock: it saves to IndexedDB and is
 * the only one generating simulated background activity. Without persistence
 * (tests, the Node server) this tab is always the leader.
 */
let leader = true
const tabEvents = new TypedEmitter<{
  leadership: boolean
  remote: { op: DbOp; isNew: boolean }
}>()

export const isLeaderTab = () => leader
export const onLeadershipChange = (listener: (isLeader: boolean) => void) =>
  tabEvents.on('leadership', listener)
/** Changes made in other tabs (already applied to this tab's database). */
export const onRemoteChange = (listener: (change: { op: DbOp; isNew: boolean }) => void) =>
  tabEvents.on('remote', listener)

function setLeader(next: boolean) {
  if (leader === next) return
  leader = next
  tabEvents.emit('leadership', next)
}

function startPersistence(target: MockDb, saveAllNow: boolean) {
  persister?.dispose()
  setLeader(false)
  persister = createPersister(target, { saveAllNow, onWriter: () => setLeader(true) })
  sync?.attach(target)
}

/** Simulates losing the network: every request fails fast until switched back. */
export function setMockNetworkOnline(online: boolean) {
  offline = !online
}

/** Override latency/failure settings (tests use zero latency and no failures). */
export function configureMockApi(overrides: Partial<MockApiConfig> & { random?: () => number }) {
  const { random: rng, ...rest } = overrides
  config = { ...config, ...rest }
  if (rng) random = rng
}

/** Fresh seed data without persistence, e.g. between tests. */
export function resetMockApi(options?: ConstructorParameters<typeof MockDb>[0]) {
  persister?.dispose()
  persister = null
  sync?.dispose()
  sync = null
  setLeader(true)
  ready = Promise.resolve()
  db = new MockDb(options)
  config = { ...defaultMockApiConfig }
  random = Math.random
  offline = false
}

/**
 * Loads the persisted database (IndexedDB) if there is one, otherwise seeds a
 * new one, and saves every later change. Requests wait for this to finish.
 */
export function initMockApi({ persist }: { persist: boolean }): Promise<void> {
  ready = (async () => {
    if (!persist || !isPersistenceAvailable()) return
    try {
      sync?.dispose()
      sync = createTabSync({
        onRemoteOp: (op, info) => tabEvents.emit('remote', { op, ...info }),
        onReset: () => typeof window !== 'undefined' && window.location.reload(),
        onFlushRequest: async () => {
          if (!persister?.isWriter()) return false
          await persister.flush()
          return true
        },
      })
      // Another tab may hold unsaved changes: have it save before we read.
      await sync.requestFlush()
      const snapshot = await loadSnapshot()
      db = snapshot ? new MockDb({ snapshot }) : new MockDb()
      startPersistence(db, !snapshot || db.repaired)
    } catch (error) {
      console.warn('[mock-api] persistence unavailable, using in-memory data', error)
    }
  })()
  return ready
}

/** Wipes persisted data and starts again from fresh seed data. */
export async function resetPersistedData(): Promise<void> {
  await ready
  persister?.dispose()
  persister = null
  await clearPersisted()
  db = new MockDb()
  // Other tabs hold the old data in memory: make them reload, or they'd save it back.
  sync?.broadcastReset()
  if (isPersistenceAvailable()) {
    startPersistence(db, true)
    await persister!.flush()
  }
}

/** Writes pending changes now (tests and page unload). */
export const flushPersistence = () => persister?.flush() ?? Promise.resolve()

/** Shared with the realtime simulator, which writes incoming messages directly. */
export const getMockDb = (): MockDb => (db ??= new MockDb())

type Kind = 'read' | 'write'

/**
 * Wraps a DB call with network-like latency and random failures.
 * The DB runs after the delay, so a failed request never changes data.
 */
async function request<T>(kind: Kind, label: string, run: (db: MockDb) => T): Promise<T> {
  await ready
  if (offline) throw new MockApiError(OFFLINE_MESSAGE)
  const { min, max } = config.latency
  const delay = min + random() * Math.max(0, max - min)
  const failureRate = kind === 'read' ? config.readFailureRate : config.writeFailureRate
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      // The connection may have dropped while the request was in flight.
      if (offline) {
        reject(new MockApiError(OFFLINE_MESSAGE))
        return
      }
      if (random() < failureRate) {
        reject(new MockApiError(`Network error while trying to ${label}`))
        return
      }
      try {
        resolve(run(getMockDb()))
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
  /** Conversations plus their last messages, like a typical inbox endpoint. */
  getInbox: (): Promise<{ conversations: Conversation[]; lastMessages: Message[] }> =>
    request('read', 'load conversations', (d) => ({
      conversations: d.getConversations(),
      lastMessages: d.getLastMessages(),
    })),
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

  /** Demo helper: wipe persisted data and reseed. */
  resetDemoData: (): Promise<void> => resetPersistedData(),
}

export type MockApi = typeof mockApi

/**
 * Keeps this (REST) backend in sync with events from the separate WebSocket
 * server, the way a real backend would share one database. Unknown ids are
 * ignored (e.g. a message this backend never saw).
 */
export function applyServerEvent(frame: ServerFrame): void {
  const db = getMockDb()
  try {
    switch (frame.type) {
      case 'message:new':
        db.insertExternal(frame.payload.message)
        break
      case 'message:status':
        db.setMessageStatus(frame.payload.messageId, frame.payload.status)
        break
      case 'presence:change':
        db.setPresence(frame.payload.userId, frame.payload.isOnline)
        break
      default:
        break // typing is transient: nothing to store
    }
  } catch {
    // Out of sync with the server for this id: skip.
  }
}

// In the browser, persist the fake backend to IndexedDB. Tests (and the Node
// WebSocket server, which has no import.meta.env) don't.
if (import.meta.env?.MODE && import.meta.env.MODE !== 'test') void initMockApi({ persist: true })
