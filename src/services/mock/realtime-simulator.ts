import { defaultRealtimeConfig, type RealtimeSimulatorConfig } from '@/shared/lib/configs/mock-api'
import type { ConversationId, ISODateString, MessageId, UserId } from '@/types/common.types'
import type { Message, MessageStatus } from '@/types/message.types'
import { phrases, replyPhrases } from './data/phrases'
import { pick, type Rng } from './data/random'
import { getMockDb } from './mock-api'
import type { MockDb } from './mock-db'
import { TypedEmitter } from './typed-emitter'

/** Events pushed from the fake server to the client. */
// A type alias (not an interface) so keys stay literal and it satisfies Record<string, unknown>.
export type RealtimeEventMap = {
  'message:new': { message: Message }
  'message:status': { conversationId: ConversationId; messageId: MessageId; status: MessageStatus }
  'typing:start': { conversationId: ConversationId; userId: UserId }
  'typing:stop': { conversationId: ConversationId; userId: UserId }
  'presence:change': { userId: UserId; isOnline: boolean; lastSeen?: ISODateString }
}

export type RealtimeEventType = keyof RealtimeEventMap

export interface RealtimeSimulatorOptions {
  config?: Partial<RealtimeSimulatorConfig>
  random?: Rng
  /** Where the simulator reads and writes data. Defaults to the mock API's DB. */
  getDb?: () => MockDb
}

type Timer = ReturnType<typeof setTimeout>

/**
 * Pretends to be a realtime server: progresses message status, shows typing
 * before auto-replies, sends unsolicited messages and flips presence.
 *
 * Every timer is tracked so `stop()` leaves nothing running, and every `on()`
 * returns an unsubscribe function.
 */
export class RealtimeSimulator {
  private readonly emitter = new TypedEmitter<RealtimeEventMap>()
  private config: RealtimeSimulatorConfig
  private random: Rng
  private readonly getDb: () => MockDb
  private timers = new Set<Timer>()
  private intervals = new Set<ReturnType<typeof setInterval>>()
  /** Pending reply per conversation, so rapid sends produce one reply. */
  private pendingReplies = new Map<ConversationId, { timers: Timer[]; typingUserId?: UserId }>()
  private running = false

  constructor(options: RealtimeSimulatorOptions = {}) {
    this.config = { ...defaultRealtimeConfig, ...options.config }
    this.random = options.random ?? Math.random
    this.getDb = options.getDb ?? getMockDb
  }

  /** Adjusts timing or randomness (tests make the shared instance deterministic). */
  configure(options: Pick<RealtimeSimulatorOptions, 'config' | 'random'>): void {
    if (options.config) this.config = { ...this.config, ...options.config }
    if (options.random) this.random = options.random
  }

  get isRunning() {
    return this.running
  }

  on<K extends RealtimeEventType>(type: K, handler: (payload: RealtimeEventMap[K]) => void) {
    return this.emitter.on(type, handler)
  }

  listenerCount(type?: RealtimeEventType) {
    return this.emitter.listenerCount(type)
  }

  /** Starts the background activity (incoming messages, presence). Idempotent. */
  start(): void {
    if (this.running) return
    this.running = true
    this.scheduleNextIncoming()
    this.intervals.add(setInterval(() => this.flipRandomPresence(), this.config.presenceIntervalMs))
  }

  /** Clears every timer. Listeners stay attached so `start()` can resume. */
  stop(): void {
    this.running = false
    this.timers.forEach(clearTimeout)
    this.timers.clear()
    this.intervals.forEach(clearInterval)
    this.intervals.clear()
    this.pendingReplies.clear()
  }

  /** `stop()` plus removing every listener. */
  dispose(): void {
    this.stop()
    this.emitter.removeAllListeners()
  }

  /**
   * Call after the server accepts one of the user's messages.
   * Emits delivered → read, then typing → reply (with `replyProbability`).
   */
  handleOutgoingMessage(message: Message): void {
    const { deliveredDelayMs, readDelayMs, typingDelayMs, typingDurationMs } = this.config
    const { conversationId, id } = message

    this.later(deliveredDelayMs, () => this.setStatus(conversationId, id, 'delivered'))
    this.later(deliveredDelayMs + readDelayMs, () => this.setStatus(conversationId, id, 'read'))

    // A newer message replaces any reply still pending in this conversation.
    this.cancelPendingReply(conversationId)
    if (this.random() >= this.config.replyProbability) return

    const responders = this.safe(() => this.getDb().getOtherParticipants(conversationId)) ?? []
    if (responders.length === 0) return
    const responder = pick(this.random, responders)
    const pending: { timers: Timer[]; typingUserId?: UserId } = { timers: [] }
    this.pendingReplies.set(conversationId, pending)

    const typingAt = deliveredDelayMs + readDelayMs + typingDelayMs
    pending.timers.push(
      this.later(typingAt, () => {
        pending.typingUserId = responder
        this.emitter.emit('typing:start', { conversationId, userId: responder })
      }),
      this.later(typingAt + typingDurationMs, () => {
        this.pendingReplies.delete(conversationId)
        this.emitter.emit('typing:stop', { conversationId, userId: responder })
        this.deliverIncoming(conversationId, responder, pick(this.random, replyPhrases))
      }),
    )
  }

  /** Immediately pushes a message from someone else (also used by tests and demos). */
  deliverIncoming(conversationId: ConversationId, senderId: UserId, content: string): void {
    const message = this.safe(() =>
      this.getDb().insertIncomingMessage(conversationId, senderId, content),
    )
    if (message) this.emitter.emit('message:new', { message })
  }

  // ---------- background activity ----------

  private scheduleNextIncoming() {
    const { min, max } = this.config.incomingIntervalMs
    this.later(min + this.random() * (max - min), () => {
      this.simulateIncoming()
      if (this.running) this.scheduleNextIncoming()
    })
  }

  /** Someone types for a moment, then a message arrives in a random chat. */
  private simulateIncoming() {
    const conversations = this.safe(() => this.getDb().getConversations()) ?? []
    if (conversations.length === 0) return
    const conversation = pick(this.random, conversations)
    const others = this.safe(() => this.getDb().getOtherParticipants(conversation.id)) ?? []
    if (others.length === 0) return
    const senderId = pick(this.random, others)
    const conversationId = conversation.id

    this.emitter.emit('typing:start', { conversationId, userId: senderId })
    this.later(this.config.typingDurationMs, () => {
      this.emitter.emit('typing:stop', { conversationId, userId: senderId })
      this.deliverIncoming(conversationId, senderId, pick(this.random, phrases))
    })
  }

  private flipRandomPresence() {
    const db = this.getDb()
    const others = db.getUsers().filter((u) => u.id !== db.currentUserId)
    if (others.length === 0) return
    const user = pick(this.random, others)
    const updated = db.setPresence(user.id, !user.isOnline)
    this.emitter.emit('presence:change', {
      userId: updated.id,
      isOnline: updated.isOnline,
      lastSeen: updated.lastSeen,
    })
  }

  // ---------- helpers ----------

  private setStatus(conversationId: ConversationId, messageId: MessageId, status: MessageStatus) {
    const updated = this.safe(() => this.getDb().setMessageStatus(messageId, status))
    if (updated) this.emitter.emit('message:status', { conversationId, messageId, status })
  }

  private cancelPendingReply(conversationId: ConversationId) {
    const pending = this.pendingReplies.get(conversationId)
    if (!pending) return
    pending.timers.forEach((t) => {
      clearTimeout(t)
      this.timers.delete(t)
    })
    if (pending.typingUserId) {
      this.emitter.emit('typing:stop', { conversationId, userId: pending.typingUserId })
    }
    this.pendingReplies.delete(conversationId)
  }

  private later(ms: number, fn: () => void): Timer {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      fn()
    }, ms)
    this.timers.add(timer)
    return timer
  }

  /** The data may have changed (deleted message, removed chat): skip quietly. */
  private safe<T>(fn: () => T): T | undefined {
    try {
      return fn()
    } catch {
      return undefined
    }
  }

  /** Number of timers still scheduled (for leak checks in tests). */
  get pendingTimerCount() {
    return this.timers.size + this.intervals.size
  }
}

/** App-wide instance used by the realtime services. */
export const realtimeSimulator = new RealtimeSimulator()
