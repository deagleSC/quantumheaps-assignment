import { RealtimeSimulator, type RealtimeEventMap } from '../realtime-simulator'
import { MockDb } from '../mock-db'

const config = {
  deliveredDelayMs: 100,
  readDelayMs: 200,
  typingDelayMs: 300,
  typingDurationMs: 1000,
  replyProbability: 1,
  incomingIntervalMs: { min: 5000, max: 5000 },
  presenceIntervalMs: 7000,
}

let db: MockDb
let sim: RealtimeSimulator
let events: { type: keyof RealtimeEventMap; payload: unknown }[]

function record(s: RealtimeSimulator) {
  const types: (keyof RealtimeEventMap)[] = [
    'message:new',
    'message:status',
    'typing:start',
    'typing:stop',
    'presence:change',
  ]
  return types.map((type) => s.on(type, (payload) => events.push({ type, payload })))
}

beforeEach(() => {
  vi.useFakeTimers()
  db = new MockDb({ now: Date.parse('2026-11-12T12:00:00Z') })
  sim = new RealtimeSimulator({ config, random: () => 0, getDb: () => db })
  events = []
  record(sim)
})
afterEach(() => {
  sim.dispose()
  vi.useRealTimers()
})

const send = (content = 'hi') =>
  db.insertOwnMessage({ conversationId: 'c-daniel', content, clientId: 't' })

describe('RealtimeSimulator outgoing flow', () => {
  beforeEach(() => {
    // Running, with background activity pushed outside these tests' time window.
    sim.configure({
      config: { incomingIntervalMs: { min: 1e6, max: 1e6 }, presenceIntervalMs: 1e6 },
    })
    sim.start()
  })

  it('progresses sent → delivered → read, then typing → reply', () => {
    const msg = send()
    sim.handleOutgoingMessage(msg)

    vi.advanceTimersByTime(100)
    expect(events.at(-1)).toEqual({
      type: 'message:status',
      payload: { conversationId: 'c-daniel', messageId: msg.id, status: 'delivered' },
    })
    vi.advanceTimersByTime(200)
    expect(db.getMessage(msg.id).status).toBe('read')

    vi.advanceTimersByTime(300)
    expect(events.at(-1)).toEqual({
      type: 'typing:start',
      payload: { conversationId: 'c-daniel', userId: 'u-daniel' },
    })

    vi.advanceTimersByTime(1000)
    expect(events.map((e) => e.type).slice(-2)).toEqual(['typing:stop', 'message:new'])
    const reply = (events.at(-1)!.payload as RealtimeEventMap['message:new']).message
    expect(reply).toMatchObject({ conversationId: 'c-daniel', senderId: 'u-daniel' })
    expect(db.getConversation('c-daniel').lastMessageId).toBe(reply.id)
    // Only the background timers remain (next incoming message + presence interval).
    expect(sim.pendingTimerCount).toBe(2)
  })

  it('sends one reply for rapid messages and stops the earlier typing indicator', () => {
    sim.handleOutgoingMessage(send('one'))
    vi.advanceTimersByTime(700) // first reply is typing now
    sim.handleOutgoingMessage(send('two'))
    expect(events.at(-1)?.type).toBe('typing:stop')
    vi.advanceTimersByTime(5000)
    const replies = events.filter((e) => e.type === 'message:new')
    expect(replies).toHaveLength(1)
  })

  it('skips the reply when replyProbability says no', () => {
    const quiet = new RealtimeSimulator({
      config: {
        ...config,
        replyProbability: 0,
        incomingIntervalMs: { min: 1e6, max: 1e6 },
        presenceIntervalMs: 1e6,
      },
      random: () => 0.5,
      getDb: () => db,
    })
    quiet.start()
    const seen: string[] = []
    quiet.on('message:new', () => seen.push('new'))
    quiet.handleOutgoingMessage(send())
    vi.advanceTimersByTime(10_000)
    expect(seen).toEqual([])
    quiet.dispose()
  })

  it('ignores messages deleted before their status changes', () => {
    const msg = send()
    sim.handleOutgoingMessage(msg)
    db.deleteMessage(msg.id)
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
  })
})

describe('RealtimeSimulator background activity', () => {
  it('delivers unsolicited messages after typing and bumps unread', () => {
    sim.start()
    const conv = db.getConversations()[0]!
    const unreadBefore = conv.unreadCount
    vi.advanceTimersByTime(5000)
    expect(events.at(-1)?.type).toBe('typing:start')
    vi.advanceTimersByTime(1000)
    expect(events.at(-1)?.type).toBe('message:new')
    expect(db.getConversation(conv.id).unreadCount).toBe(unreadBefore + 1)
  })

  it('flips presence on an interval', () => {
    sim.start()
    vi.advanceTimersByTime(7000)
    const presence = events.find((e) => e.type === 'presence:change')
    expect(presence).toBeDefined()
    const { userId, isOnline } = presence!.payload as RealtimeEventMap['presence:change']
    expect(db.getUser(userId).isOnline).toBe(isOnline)
  })

  it('start() is idempotent and stop() clears every timer', () => {
    sim.start()
    sim.start()
    sim.handleOutgoingMessage(send())
    expect(sim.pendingTimerCount).toBeGreaterThan(0)
    sim.stop()
    expect(sim.pendingTimerCount).toBe(0)
    expect(sim.isRunning).toBe(false)
    const count = events.length
    vi.advanceTimersByTime(60_000)
    expect(events).toHaveLength(count)
  })

  it('buffers outgoing messages while stopped and handles them on start()', () => {
    const msg = send()
    sim.handleOutgoingMessage(msg)
    vi.advanceTimersByTime(5000)
    expect(events).toEqual([])
    sim.configure({
      config: { incomingIntervalMs: { min: 1e6, max: 1e6 }, presenceIntervalMs: 1e6 },
    })
    sim.start()
    vi.advanceTimersByTime(100)
    expect(events.at(-1)).toMatchObject({
      type: 'message:status',
      payload: { status: 'delivered' },
    })
  })

  it('configure() changes timing and randomness', () => {
    sim.configure({ config: { deliveredDelayMs: 10, incomingIntervalMs: { min: 1e6, max: 1e6 } } })
    sim.start()
    const msg = send()
    sim.handleOutgoingMessage(msg)
    vi.advanceTimersByTime(10)
    expect(db.getMessage(msg.id).status).toBe('delivered')
  })

  it('unsubscribe and dispose remove listeners', () => {
    const off = sim.on('message:new', vi.fn())
    expect(sim.listenerCount('message:new')).toBe(2)
    off()
    expect(sim.listenerCount('message:new')).toBe(1)
    sim.dispose()
    expect(sim.listenerCount()).toBe(0)
  })
})
